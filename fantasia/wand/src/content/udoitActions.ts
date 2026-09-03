import { ADVANCE_PENDING_STORAGE_KEY } from "../shared/remediation";
import { normalize } from "../shared/utils";
import { postActionStateToTop, postActionSuccessToTop, postRemediationErrorToTop } from "./frameBridge";
import { reportError } from "./diagnostics";
import { isVisible } from "./udoitTextInput";

const PREVIEW_CONTROL_PATTERN = /^(?:expand preview|preview|show preview|view preview)$/i;
const SAVE_CONTROL_PATTERN = /^(?:save|save changes|apply|update)$/i;
const DELETE_EMPTY_HEADING_PATTERN = /^delete heading instead$/i;

export async function expandUdoitPreview(): Promise<void> {
  postActionStateToTop(true, "Opening preview...");
  try {
    const control = getEnabledControl(PREVIEW_CONTROL_PATTERN);
    if (!control) {
      failUdoitAction("preview-control-not-found", "Wand couldn't find UDOIT's preview control.");
      return;
    }

    realClick(control);
    await wait(500);
    postActionSuccessToTop("UDOIT preview opened. Review it before saving.");
  } finally {
    postActionStateToTop(false);
  }
}

export async function saveUdoitFixAndAdvance(): Promise<void> {
  postActionStateToTop(true, "Saving and loading the next issue...");
  let handedOff = false;
  try {
    const saveControl = getEnabledControl(SAVE_CONTROL_PATTERN);
    if (!saveControl) {
      failUdoitAction("save-control-not-found", "Wand couldn't find UDOIT's Save control.");
      return;
    }

    await chrome.storage.local.set({
      [ADVANCE_PENDING_STORAGE_KEY]: Date.now(),
    });
    realClick(saveControl);
    handedOff = true;
    postActionSuccessToTop("UDOIT save started. Wand will advance when the next issue is ready.");
  } catch (error) {
    await chrome.storage.local.remove(ADVANCE_PENDING_STORAGE_KEY);
    failUdoitAction("save-and-next-failed", "Wand couldn't save this UDOIT fix.", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (!handedOff) {
      postActionStateToTop(false);
    }
  }
}

export async function prepareEmptyHeadingRemoval(): Promise<void> {
  postActionStateToTop(true, "Preparing empty-heading removal...");
  try {
    const checkbox = getCheckboxByLabel(DELETE_EMPTY_HEADING_PATTERN);
    if (!checkbox) {
      failUdoitAction("empty-heading-removal-control-not-found", "Wand couldn't find UDOIT's empty-heading removal option.");
      return;
    }

    if (!checkbox.checked) {
      realClick(checkbox);
    }
    postActionSuccessToTop("Empty-heading removal is selected. Review the preview, then save when ready.");
  } finally {
    postActionStateToTop(false);
  }
}

function getCheckboxByLabel(pattern: RegExp): HTMLInputElement | null {
  const label = Array.from(document.querySelectorAll<HTMLLabelElement>("label"))
    .find((candidate) => isVisible(candidate) && pattern.test(normalize(candidate.innerText || candidate.textContent)));
  if (!label) {
    return null;
  }

  const input = label.htmlFor ? document.getElementById(label.htmlFor) : label.querySelector("input[type='checkbox']");
  return input instanceof HTMLInputElement && input.type === "checkbox" ? input : null;
}

function getEnabledControl(pattern: RegExp): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], input[type='button'], input[type='submit']"))
    .find((control) => isVisible(control) && !isDisabled(control) && pattern.test(getControlLabel(control))) ?? null;
}

function getControlLabel(control: HTMLElement): string {
  if (control instanceof HTMLInputElement) {
    return normalize(control.value || control.getAttribute("aria-label") || control.title);
  }

  return normalize(control.innerText || control.textContent || control.getAttribute("aria-label") || control.title);
}

function isDisabled(control: HTMLElement): boolean {
  if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
    return control.disabled;
  }

  return control.getAttribute("aria-disabled") === "true";
}

function failUdoitAction(code: string, message: string, details: Record<string, unknown> = {}): void {
  reportError(code, message, undefined, {
    buttons: Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], input[type='button'], input[type='submit']"))
      .map(getControlLabel)
      .filter(Boolean)
      .slice(0, 20),
    ...details,
  });
  postRemediationErrorToTop(`${message} Bug code: ${code}`);
}

function realClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
  const ptr = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
  el.dispatchEvent(new PointerEvent("pointerdown", ptr));
  el.dispatchEvent(new MouseEvent("mousedown", base));
  el.dispatchEvent(new PointerEvent("pointerup", ptr));
  el.dispatchEvent(new MouseEvent("mouseup", base));
  el.dispatchEvent(new MouseEvent("click", base));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
