import { REMEDIATION_STORAGE_KEY, type PendingRemediation } from "../shared/remediation";
import { normalize } from "../shared/utils";

const HIGHLIGHT_ID = "wand-remediation-highlight";
const HIGHLIGHT_MAX_AGE_MS = 5 * 60 * 1000;
const MIN_MATCH_LENGTH = 24;

let editorWatcherCleanup: (() => void) | null = null;

type WindowWithFind = Window & {
  find?: (
    string: string,
    caseSensitive?: boolean,
    backwards?: boolean,
    wrapAround?: boolean,
    wholeWord?: boolean,
    searchInFrames?: boolean,
    showDialog?: boolean
  ) => boolean;
};

export async function initializeCanvasHighlighter(): Promise<void> {
  if (!window.location.hostname.endsWith(".instructure.com")) {
    return;
  }

  const pendingRemediation = await getPendingRemediation();
  if (!pendingRemediation || Date.now() - pendingRemediation.createdAt > HIGHLIGHT_MAX_AGE_MS) {
    return;
  }

  if (!pageMatchesRemediation(pendingRemediation)) {
    return;
  }

  if (!isEditPage() && clickEditLink()) {
    console.info("[wand] Canvas target opened. Entering edit mode before highlighting.");
    return;
  }

  const editPage = isEditPage();
  const highlighted = editPage
    ? await findAndHighlightText(pendingRemediation.previewText)
    : await waitForHighlight(pendingRemediation.previewText);
  if (!highlighted) {
    console.info("[wand] Canvas target opened, but no matching preview text was found.", pendingRemediation);
    return;
  }

  console.info("[wand] Canvas remediation target highlighted.", { editPage });
}

async function getPendingRemediation(): Promise<PendingRemediation | null> {
  const result = await chrome.storage.local.get(REMEDIATION_STORAGE_KEY);
  const value = result[REMEDIATION_STORAGE_KEY];

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as PendingRemediation;
}

function pageMatchesRemediation(remediation: PendingRemediation): boolean {
  if (isEditPage()) {
    return true;
  }

  const pageText = normalize(document.body.innerText || document.body.textContent);
  return pageText.includes(remediation.sourceTitle) || pageText.includes(remediation.previewText);
}

function waitForHighlight(previewText: string): Promise<boolean> {
  if (highlightPreviewText(previewText)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let observer: MutationObserver | null = null;
    const check = (): void => {
      if (!highlightPreviewText(previewText)) {
        return;
      }

      observer?.disconnect();
      document.removeEventListener("load", check, true);
      resolve(true);
    };

    observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    document.addEventListener("load", check, true);
  });
}

async function findAndHighlightText(previewText: string): Promise<boolean> {
  const targetText = getMatchText(previewText);
  if (!targetText) {
    return false;
  }

  if (selectTextInReadyEditor(targetText, "initial")) {
    startEditorReadyWatcher(targetText);
    return true;
  }

  if (isEditPage()) {
    return waitForEditorTarget(targetText);
  }

  const found = findTextInPage(previewText);
  const highlighted = highlightPreviewText(previewText, !found);
  return found || highlighted;
}

function waitForEditorTarget(targetText: string): Promise<boolean> {
  return new Promise((resolve) => {
    startEditorReadyWatcher(targetText, () => resolve(true));
  });
}

function startEditorReadyWatcher(targetText: string, onFound?: () => void): void {
  editorWatcherCleanup?.();

  let cleaned = false;
  let foundOnce = false;
  let outerObserver: MutationObserver | null = null;
  const frameCleanups: Array<() => void> = [];
  const observedFrames = new WeakSet<HTMLIFrameElement>();
  const observedDocuments = new WeakSet<Document>();

  const cleanup = (): void => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    outerObserver?.disconnect();
    document.removeEventListener("load", checkFromEvent, true);
    window.removeEventListener("resize", checkFromEvent);
    frameCleanups.forEach((frameCleanup) => frameCleanup());
    if (editorWatcherCleanup === cleanup) {
      editorWatcherCleanup = null;
    }
  };

  const stopOnUserEdit = (event: Event): void => {
    console.info("[wand] Canvas editor interaction detected; stopping recenter watcher.", {
      type: event.type,
    });
    cleanup();
  };

  const attachFrameDocument = (doc: Document): void => {
    if (observedDocuments.has(doc)) {
      return;
    }

    observedDocuments.add(doc);

    const root = doc.documentElement || doc.body;
    const frameObserver = new MutationObserver(() => check("editor-mutation"));
    if (root) {
      frameObserver.observe(root, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    const stopEvents = ["keydown", "mousedown", "input", "paste"];
    const frameLoadEvents = ["load", "readystatechange"];
    stopEvents.forEach((eventName) => doc.addEventListener(eventName, stopOnUserEdit, true));
    frameLoadEvents.forEach((eventName) => doc.addEventListener(eventName, checkFromFrameEvent, true));
    frameCleanups.push(() => {
      frameObserver.disconnect();
      stopEvents.forEach((eventName) => doc.removeEventListener(eventName, stopOnUserEdit, true));
      frameLoadEvents.forEach((eventName) => doc.removeEventListener(eventName, checkFromFrameEvent, true));
    });
  };

  const attachFrame = (frame: HTMLIFrameElement): void => {
    if (!observedFrames.has(frame)) {
      observedFrames.add(frame);
      frame.addEventListener("load", checkFromFrameEvent, true);
      frameCleanups.push(() => frame.removeEventListener("load", checkFromFrameEvent, true));
    }

    const doc = getFrameDocument(frame);
    if (doc) {
      attachFrameDocument(doc);
    }
  };

  const attachEditableFrames = (): void => {
    findEditableFrames().forEach(attachFrame);
  };

  const check = (reason: string): void => {
    if (cleaned) {
      return;
    }

    attachEditableFrames();

    if (!selectTextInReadyEditor(targetText, reason)) {
      return;
    }

    if (!foundOnce) {
      foundOnce = true;
      onFound?.();
    }
  };

  const checkFromEvent = (event: Event): void => {
    check(event.type);
  };

  const checkFromFrameEvent = (event: Event): void => {
    check(`editor-${event.type}`);
  };

  outerObserver = new MutationObserver(() => check("page-mutation"));
  outerObserver.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  document.addEventListener("load", checkFromEvent, true);
  window.addEventListener("resize", checkFromEvent);

  editorWatcherCleanup = cleanup;
  console.info("[wand] Waiting for Canvas editor target.", {
    frameCount: findEditableFrames().length,
    targetText,
  });
  check("start");
}

function selectTextInReadyEditor(targetText: string, reason: string): boolean {
  const frame = getReadyEditableFrame(targetText);
  if (!frame) {
    return false;
  }

  if (isSelectionCenteredInEditor(frame, targetText)) {
    return true;
  }

  if (isMatchingSelectionInEditor(frame, targetText)) {
    centerEditorSelection(frame);
    return true;
  }

  if (!selectTextInEditorFrame(frame, targetText)) {
    return false;
  }

  centerEditorSelection(frame);
  console.info("[wand] Canvas editor target selected.", { reason });
  return true;
}

function getReadyEditableFrame(targetText: string): HTMLIFrameElement | null {
  const frame = findEditableFrame(targetText);
  if (!frame) {
    return null;
  }

  const frameDocument = getFrameDocument(frame);
  if (!frameDocument?.body || frameDocument.readyState === "loading") {
    return null;
  }

  const frameText = normalize(frameDocument?.body?.innerText || frameDocument?.body?.textContent);
  if (!frameText || !textMatches(frameText, targetText)) {
    return null;
  }

  return frame;
}

function isSelectionCenteredInEditor(frame: HTMLIFrameElement, targetText: string): boolean {
  if (!isMatchingSelectionInEditor(frame, targetText)) {
    return false;
  }

  const range = getEditorSelectionRange(frame);
  const frameWindow = frame.contentWindow;
  if (!range || !frameWindow) {
    return false;
  }

  const rect = range.getBoundingClientRect();
  if (!rect.height && !rect.width) {
    return false;
  }

  const viewportHeight = frameWindow.innerHeight || frame.clientHeight;
  const selectionCenter = rect.top + rect.height / 2;
  return selectionCenter >= viewportHeight * 0.4 && selectionCenter <= viewportHeight * 0.6;
}

function isMatchingSelectionInEditor(frame: HTMLIFrameElement, targetText: string): boolean {
  const selection = frame.contentWindow?.getSelection();
  const selectedText = normalize(selection?.toString());
  return Boolean(selectedText && textMatches(selectedText, targetText));
}

function getEditorSelectionRange(frame: HTMLIFrameElement): Range | null {
  const selection = frame.contentWindow?.getSelection();
  return selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
}

function centerEditorSelection(frame: HTMLIFrameElement): void {
  const frameWindow = frame.contentWindow;
  const frameDocument = getFrameDocument(frame);
  const range = getEditorSelectionRange(frame);
  const scroller = getEditorScroller(frame);
  if (!frameWindow || !frameDocument || !range || !scroller) {
    return;
  }

  const rect = range.getBoundingClientRect();
  if (!rect || (!rect.height && !rect.width)) {
    return;
  }

  const viewportHeight = getEditorViewportHeight(frame, scroller, frameWindow);
  const viewportWidth = getEditorViewportWidth(frame, scroller, frameWindow);
  const targetTop = scroller.scrollTop + rect.top - (viewportHeight - rect.height) / 2;
  const targetLeft = scroller.scrollLeft + rect.left - (viewportWidth - rect.width) / 2;
  setEditorScrollPosition(frameDocument, frameWindow, scroller, targetLeft, targetTop);

  const updatedRect = getEditorSelectionRange(frame)?.getBoundingClientRect();
  if (!updatedRect) {
    return;
  }

  const correctionTop = updatedRect.top - (viewportHeight - updatedRect.height) / 2;
  const correctionLeft = updatedRect.left - (viewportWidth - updatedRect.width) / 2;
  if (Math.abs(correctionTop) > 1 || Math.abs(correctionLeft) > 1) {
    setEditorScrollPosition(
      frameDocument,
      frameWindow,
      scroller,
      scroller.scrollLeft + correctionLeft,
      scroller.scrollTop + correctionTop
    );
  }
}

function findTextInPage(previewText: string): boolean {
  const targetText = getMatchText(previewText);
  const find = (window as WindowWithFind).find;
  if (!targetText || typeof find !== "function") {
    return false;
  }

  window.focus();
  return find.call(window, targetText, false, false, true, false, true, false);
}

function highlightPreviewText(previewText: string, scroll = true): boolean {
  const targetText = getMatchText(previewText);
  if (!targetText) {
    return false;
  }

  const editorHighlighted = highlightEditorText(targetText, scroll);
  if (editorHighlighted) {
    return true;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const text = normalize(textNode.textContent);

    if (textMatches(text, targetText)) {
      highlightTextNode(textNode, scroll);
      return true;
    }

    currentNode = walker.nextNode();
  }

  const fallbackElement = findElementContainingText(targetText);
  if (!fallbackElement) {
    return false;
  }

  injectHighlightStyles(document);
  fallbackElement.id = HIGHLIGHT_ID;
  fallbackElement.classList.add("wand-remediation-highlight");
  if (scroll) {
    fallbackElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return true;
}

function highlightEditorText(targetText: string, scroll: boolean): boolean {
  const frame = findEditableFrame(targetText);
  if (!frame) {
    return false;
  }

  return selectTextInFrame(frame, targetText, scroll);
}

function isEditPage(): boolean {
  return /\/edit(?:$|[?#])/.test(window.location.href) || Boolean(document.querySelector(".ic-RichContentEditor, .tox-tinymce, textarea"));
}

function clickEditLink(): boolean {
  const editLink = document.querySelector<HTMLAnchorElement>("a.edit_assignment_link[href], a.quiz-edit-button[href], a[href$='/edit']");
  if (!editLink) {
    return false;
  }

  editLink.click();
  return true;
}

function highlightTextNode(textNode: Text, scroll: boolean): void {
  const parent = textNode.parentElement;
  if (!parent) {
    return;
  }

  injectHighlightStyles(document);
  parent.id = HIGHLIGHT_ID;
  parent.classList.add("wand-remediation-highlight");
  if (scroll) {
    parent.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function findElementContainingText(targetText: string): HTMLElement | null {
  return findElementContainingTextInRoot(document, targetText);
}

function findElementContainingTextInRoot(root: ParentNode, targetText: string): HTMLElement | null {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, span, div, strong, em"));

  return elements.find((element) => textMatches(normalize(element.innerText || element.textContent), targetText)) ?? null;
}

function getFrameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

function findEditableFrame(targetText?: string): HTMLIFrameElement | null {
  const frames = findEditableFrames();
  if (!targetText) {
    return frames[0] ?? null;
  }

  return frames.find((frame) => {
    const frameDocument = getFrameDocument(frame);
    const frameText = normalize(frameDocument?.body?.innerText || frameDocument?.body?.textContent);
    return Boolean(frameText && textMatches(frameText, targetText));
  }) ?? frames[0] ?? null;
}

function findEditableFrames(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>(".tox-edit-area__iframe, iframe[id$='_ifr'], iframe[id^='quiz_description']"));
}

function selectTextInFrame(frame: HTMLIFrameElement, previewText: string, scroll = true): boolean {
  const targetText = getMatchText(previewText);
  if (!targetText) {
    return false;
  }

  const found = selectTextInEditorFrame(frame, targetText);
  if (!found) {
    return false;
  }

  if (scroll) {
    centerEditorSelection(frame);
    startEditorReadyWatcher(targetText);
  }

  return true;
}

function findTextInEditorFrame(frame: HTMLIFrameElement, targetText: string): boolean {
  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    return false;
  }

  const find = (frameWindow as WindowWithFind).find;
  if (typeof find !== "function") {
    return false;
  }

  frameWindow.focus();
  return find.call(frameWindow, targetText, false, false, true, false, true, false);
}

function selectTextInEditorFrame(frame: HTMLIFrameElement, targetText: string): boolean {
  if (findTextInEditorFrame(frame, targetText) && isMatchingSelectionInEditor(frame, targetText)) {
    return true;
  }

  const selectedByRange = selectTextRangeInEditorFrame(frame, targetText);
  if (selectedByRange) {
    console.info("[wand] Canvas editor target selected by DOM range fallback.");
  }

  return selectedByRange;
}

function selectTextRangeInEditorFrame(frame: HTMLIFrameElement, targetText: string): boolean {
  const frameWindow = frame.contentWindow;
  const frameDocument = getFrameDocument(frame);
  const root = frameDocument?.body;
  if (!frameWindow || !frameDocument || !root) {
    return false;
  }

  const range = findTextRangeInRoot(frameDocument, root, targetText);
  if (!range) {
    return false;
  }

  frameWindow.focus();
  const selection = frameWindow.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function findTextRangeInRoot(rootDocument: Document, root: HTMLElement, targetText: string): Range | null {
  const walker = rootDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const text = textNode.textContent ?? "";
    const exactIndex = text.indexOf(targetText);
    if (exactIndex >= 0) {
      const range = rootDocument.createRange();
      range.setStart(textNode, exactIndex);
      range.setEnd(textNode, exactIndex + targetText.length);
      return range;
    }

    if (textMatches(normalize(text), targetText)) {
      const range = rootDocument.createRange();
      range.selectNodeContents(textNode);
      return range;
    }

    currentNode = walker.nextNode();
  }

  const element = findElementContainingTextInRoot(root, targetText);
  if (!element) {
    return null;
  }

  const range = rootDocument.createRange();
  range.selectNodeContents(element);
  return range;
}

function getRangeElement(range: Range): HTMLElement | null {
  const container = range.startContainer;
  if (container instanceof HTMLElement) {
    return container;
  }

  return container.parentElement;
}

function getEditorScroller(frame: HTMLIFrameElement): HTMLElement | null {
  const frameDocument = getFrameDocument(frame);
  return (frameDocument?.scrollingElement as HTMLElement | null) ?? frameDocument?.documentElement ?? frameDocument?.body ?? null;
}

function getEditorViewportHeight(frame: HTMLIFrameElement, scroller: HTMLElement, frameWindow: Window): number {
  return frame.clientHeight || scroller.clientHeight || frameWindow.innerHeight;
}

function getEditorViewportWidth(frame: HTMLIFrameElement, scroller: HTMLElement, frameWindow: Window): number {
  return frame.clientWidth || scroller.clientWidth || frameWindow.innerWidth;
}

function setEditorScrollPosition(
  frameDocument: Document,
  frameWindow: Window,
  scroller: HTMLElement,
  left: number,
  top: number
): void {
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const nextTop = clamp(top, 0, maxTop);
  const nextLeft = clamp(left, 0, maxLeft);

  scroller.scrollTop = nextTop;
  scroller.scrollLeft = nextLeft;

  if (frameDocument.documentElement && frameDocument.documentElement !== scroller) {
    frameDocument.documentElement.scrollTop = nextTop;
    frameDocument.documentElement.scrollLeft = nextLeft;
  }

  if (frameDocument.body && frameDocument.body !== scroller) {
    frameDocument.body.scrollTop = nextTop;
    frameDocument.body.scrollLeft = nextLeft;
  }

  frameWindow.scrollTo(nextLeft, nextTop);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMatchText(previewText: string): string {
  const normalized = normalize(previewText);
  const sentence = normalized.split(/[.!?]/).map((part) => part.trim()).find((part) => part.length >= MIN_MATCH_LENGTH);
  return sentence ?? normalized;
}

function textMatches(text: string, targetText: string): boolean {
  if (text.includes(targetText)) {
    return true;
  }

  const targetWords = targetText.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  if (targetWords.length < 5) {
    return false;
  }

  const textWords = new Set(text.toLowerCase().split(/\W+/).filter(Boolean));
  const matchedWords = targetWords.filter((word) => textWords.has(word)).length;
  return matchedWords / targetWords.length >= 0.75;
}

function injectHighlightStyles(rootDocument: Document): void {
  if (rootDocument.getElementById("wand-highlight-style")) {
    return;
  }

  const style = rootDocument.createElement("style");
  style.id = "wand-highlight-style";
  style.textContent = `
    .wand-remediation-highlight {
      outline: 4px solid #facc15 !important;
      outline-offset: 4px !important;
      background: #fef3c7 !important;
    }
  `;
  rootDocument.documentElement.append(style);
}
