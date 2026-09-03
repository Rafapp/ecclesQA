import { applyBoldCueToSelection, initializeCanvasHighlighter, openCaptionSource } from "./canvasHighlighter";
import { initializeDevReload } from "./devReload";
import { isTopFrame, listenForActionState, listenForActionSuccess, listenForCanvasSaved, listenForFrameCommands, listenForFrameSnapshots, listenForRemediationErrors, listenForWorkspaceUrls, postActionStateToTop, postActionSuccessToTop, postCanvasSavedToTop, postCommandToFrames, postRemediationErrorToTop, postSnapshotToTop } from "./frameBridge";
import { initializeHandlers } from "./handlers";
import { createPanel, setPanelBusy, showPanelError, showPanelSuccess, updatePanelSnapshot } from "./panel";
import { refreshUdoitCaptionStatus } from "./udoitCaptionRemediator";
import { expandUdoitPreview, prepareEmptyHeadingRemoval, saveUdoitFixAndAdvance } from "./udoitActions";
import { initializeUdoitDetector } from "./udoitDetector";
import { confirmUdoitWorkspaceOpened, startUdoitRemediation } from "./udoitRemediator";
import { improveUdoitLinkText } from "./udoitLinkRemediator";
import { improveUdoitImageAltText } from "./udoitImageAltRemediator";
import { closeWorkspace, initializeWorkspace, openWorkspace } from "./workspace";
import { reportError } from "./diagnostics";
import { wandConfig } from "../shared/config";
import { ADVANCE_PENDING_STORAGE_KEY, getRemediationDefinition, isAdvancePendingFresh, REMEDIATION_STORAGE_KEY } from "../shared/remediation";
import { normalize } from "../shared/utils";

const WAND_ENABLED_STORAGE_KEY = "wandEnabled";
const topFrame = isTopFrame();
let advanceInProgress = false;
let latestFrameSnapshot = null as Parameters<typeof postSnapshotToTop>[0] | null;
let latestUdoitSnapshot = null as Parameters<typeof postSnapshotToTop>[0] | null;
let workspaceActive = false;
let workspaceRemediationSignature = "";

void initializeWand();

async function initializeWand(): Promise<void> {
  const settings = await chrome.storage.local.get(WAND_ENABLED_STORAGE_KEY);
  if (settings[WAND_ENABLED_STORAGE_KEY] === false) {
    console.info("[wand] Wand is turned off for UDOIT and Canvas pages.");
    return;
  }

console.info("[wand] Content script loaded.", {
  topFrame,
  url: window.location.href,
});

initializeDevReload();
initializeHandlers();
void initializeCanvasHighlighter();
initializeWorkspace();

const panel = wandConfig.features.panel && topFrame ? createPanel(
  () => {
    setPanelBusy(panel!, true, getRemediationBusyLabel(latestUdoitSnapshot?.remediation));
    postCommandToFrames({ type: "start-remediation" });
  },
  () => {
    setPanelBusy(panel!, true, "Marking as resolved and loading the next issue…");
    postCommandToFrames({ type: "resolve-remediation" });
  },
  (action) => {
    const labels = {
      "apply-color-cue": "Adding a non-color cue…",
      "open-caption-source": "Opening the video platform…",
      "refresh-caption-status": "Checking captions again…",
    };
    setPanelBusy(panel!, true, labels[action]);
    postCommandToFrames({ type: action });
  },
  (action) => {
    const labels = {
      "expand-preview": "Opening preview...",
      "prepare-empty-heading-removal": "Preparing empty-heading removal...",
      "save-and-next": "Saving and loading the next issue...",
    };
    setPanelBusy(panel!, true, labels[action]);
    postCommandToFrames({ type: action });
  }
) : null;

if (topFrame) {
  window.addEventListener("wand:workspace-state", (event) => {
    workspaceActive = event instanceof CustomEvent && Boolean(event.detail?.active);
    workspaceRemediationSignature = workspaceActive
      ? getRemediationSignature(latestUdoitSnapshot?.remediation)
      : "";

    if (workspaceActive) {
      postCommandToFrames({ type: "workspace-opened" });
      if (panel) {
        if (latestUdoitSnapshot) {
          updatePanelSnapshot(panel, latestUdoitSnapshot);
        }
        setPanelBusy(panel, false);
      }
    }
  });
}

if (panel) {
  listenForWorkspaceUrls((url) => {
    openWorkspace(url);
  });

  listenForRemediationErrors((message) => {
    setPanelBusy(panel, false);
    showPanelError(message);
  });

  listenForActionState((active, label) => {
    setPanelBusy(panel, active, label);
  });

  listenForActionSuccess((message) => {
    setPanelBusy(panel, false);
    showPanelSuccess(message);
  });

  listenForCanvasSaved(() => {
    setPanelBusy(panel, true, "Saving and loading the next issue…");
    console.info("[wand] Canvas save signal received in top frame.", {
      url: window.location.href,
      hasDialog: Boolean(document.querySelector("[role='dialog']")),
    });
    void completeRemediation();
  });

  listenForFrameSnapshots((snapshot) => {
    if (snapshot.pageKind === "udoit") {
      latestUdoitSnapshot = snapshot;
      updatePanelSnapshot(panel, snapshot);
      syncWorkspaceWithRemediation(snapshot.remediation);
      return;
    }

    if (!workspaceActive) {
      updatePanelSnapshot(panel, snapshot);
    }
  });

  initializeUdoitDetector((snapshot) => {
    updatePanelSnapshot(panel, snapshot);
  });
} else if (!topFrame) {
  if (window.location.hostname === "udoit3.ciditools.com") {
    listenForPendingAdvance();
    void consumePendingAdvance();
  }

  listenForFrameCommands((command) => {
    if (command.type === "start-remediation" && latestFrameSnapshot?.remediation) {
      void startCurrentRemediation(latestFrameSnapshot.remediation);
    }

    if (command.type === "advance-remediation" && (latestFrameSnapshot?.pageKind === "udoit" || window.location.hostname === "udoit3.ciditools.com")) {
      void consumePendingAdvance();
    }

    if (command.type === "resolve-remediation" && window.location.hostname === "udoit3.ciditools.com") {
      void resolveCurrentRemediation();
    }

    if (command.type === "workspace-opened" && window.location.hostname === "udoit3.ciditools.com") {
      confirmUdoitWorkspaceOpened();
    }

    if (command.type === "refresh-caption-status" && window.location.hostname === "udoit3.ciditools.com") {
      void refreshUdoitCaptionStatus();
    }

    if (command.type === "expand-preview" && window.location.hostname === "udoit3.ciditools.com") {
      void expandUdoitPreview();
    }

    if (command.type === "save-and-next" && window.location.hostname === "udoit3.ciditools.com") {
      void saveUdoitFixAndAdvance();
    }

    if (command.type === "prepare-empty-heading-removal" && window.location.hostname === "udoit3.ciditools.com") {
      void prepareEmptyHeadingRemoval();
    }

    if (command.type === "apply-color-cue" && window.location.hostname.endsWith(".instructure.com")) {
      applyColorCue();
    }

    if (command.type === "open-caption-source" && window.location.hostname.endsWith(".instructure.com")) {
      void openCaptionPlatform();
    }
  });

  initializeUdoitDetector((snapshot) => {
    latestFrameSnapshot = snapshot;
    postSnapshotToTop(snapshot);

    if (snapshot.pageKind === "udoit") {
      void consumePendingAdvance();
    }
  });
} else {
  initializeUdoitDetector(() => {});
}

function applyColorCue(): void {
  postActionStateToTop(true, "Adding a non-color cue…");
  if (!applyBoldCueToSelection()) {
    reportError("color-cue-selection-not-found", "Wand couldn't find selected Canvas text.", latestUdoitSnapshot?.remediation, {
      workspaceActive,
    });
    postRemediationErrorToTop("Wand couldn't find selected Canvas text. Select the color-only text, then try again. Bug code: color-cue-selection-not-found");
    postActionStateToTop(false);
    return;
  }

  postActionSuccessToTop("Bold was added as a non-color cue. Review the result, then save in Canvas.");
  postActionStateToTop(false);
}

async function openCaptionPlatform(): Promise<void> {
  postActionStateToTop(true, "Opening the video platform…");
  try {
    if (!await openCaptionSource()) {
      reportError("caption-platform-not-found", "Wand couldn't identify the embedded video's platform.", latestUdoitSnapshot?.remediation, {
        workspaceActive,
      });
      postRemediationErrorToTop("Wand couldn't identify the embedded video's platform. Open it from Canvas and flag this to the team. Bug code: caption-platform-not-found");
      return;
    }

    postActionSuccessToTop("The video platform opened in a new tab.");
  } finally {
    postActionStateToTop(false);
  }
}
}

function syncWorkspaceWithRemediation(remediation: Parameters<typeof startUdoitRemediation>[0] | undefined): void {
  if (!workspaceActive || !remediation) {
    return;
  }

  const nextSignature = getRemediationSignature(remediation);
  if (!nextSignature || !workspaceRemediationSignature) {
    workspaceRemediationSignature = nextSignature;
    return;
  }

  if (nextSignature === workspaceRemediationSignature) {
    return;
  }

  workspaceRemediationSignature = nextSignature;
  console.info("[wand] UDOIT issue changed while workspace was open. Synchronizing Canvas remediation.", {
    issueType: remediation.issueType,
    sourceTitle: remediation.sourceTitle,
    issueIndex: remediation.issueIndex,
  });
  postCommandToFrames({ type: "start-remediation" });
}

function getRemediationBusyLabel(remediation: Parameters<typeof startUdoitRemediation>[0] | undefined): string {
  return remediation
    ? getRemediationDefinition(remediation.issueType)?.busyLabel ?? "Opening Canvas remediation…"
    : "Opening Canvas remediation…";
}

function startCurrentRemediation(remediation: Parameters<typeof startUdoitRemediation>[0]): Promise<void> {
  const workflow = getRemediationDefinition(remediation.issueType)?.workflow;
  if (workflow === "linkText") {
    return improveUdoitLinkText(remediation);
  }
  if (workflow === "imageAlt") {
    return improveUdoitImageAltText(remediation);
  }
  return startUdoitRemediation(remediation);
}

async function completeRemediation(): Promise<void> {
  await chrome.storage.local.set({
    [ADVANCE_PENDING_STORAGE_KEY]: Date.now(),
  });
  await chrome.storage.local.remove(REMEDIATION_STORAGE_KEY);
  closeWorkspace();
  postCommandToFrames({ type: "advance-remediation" });
}

async function resolveCurrentRemediation(): Promise<void> {
  postActionStateToTop(true, "Marking as resolved and loading the next issue…");
  let handedOff = false;
  try {
    const manualResolution = await waitFor(() => getElementByText("span", "Manual Resolution"), 5000, 200);
    if (!manualResolution) {
      reportError("manual-resolution-control-not-found", "Wand couldn't find UDOIT's Manual Resolution control.", latestFrameSnapshot?.remediation);
      postRemediationErrorToTop("Wand couldn't find UDOIT's Manual Resolution control. Bug code: manual-resolution-control-not-found");
      return;
    }

    let confirmation = getManualResolutionCheckbox();
    if (!confirmation) {
      realClick(manualResolution);
      confirmation = await waitFor(getManualResolutionCheckbox, 5000, 200);
    }

    if (!confirmation) {
      reportError("manual-resolution-confirmation-not-found", "Wand couldn't confirm the manual resolution in UDOIT.", latestFrameSnapshot?.remediation);
      postRemediationErrorToTop("Wand couldn't confirm the manual resolution in UDOIT. Bug code: manual-resolution-confirmation-not-found");
      return;
    }

    if (!confirmation.checked) {
      realClick(confirmation);
      await sleep(800);
    }

    postCanvasSavedToTop();
    handedOff = true;
  } finally {
    if (!handedOff) {
      postActionStateToTop(false);
    }
  }
}

function getManualResolutionCheckbox(): HTMLInputElement | null {
  const label = Array.from(document.querySelectorAll<HTMLLabelElement>("label")).find((candidate) =>
    normalize(candidate.textContent).includes("confirm this content")
  );
  if (!label) {
    return null;
  }

  const inputId = label.htmlFor;
  const input = inputId ? document.getElementById(inputId) : label.querySelector("input[type='checkbox']");
  return input instanceof HTMLInputElement && input.type === "checkbox" ? input : null;
}

function getElementByText(selector: string, text: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) =>
    normalize(element.textContent) === text
  ) ?? null;
}

function listenForPendingAdvance(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[ADVANCE_PENDING_STORAGE_KEY]?.newValue) {
      return;
    }

    void consumePendingAdvance();
  });
}

async function consumePendingAdvance(): Promise<void> {
  if (window.location.hostname !== "udoit3.ciditools.com") {
    return;
  }

  if (advanceInProgress) {
    return;
  }

  const pending = await chrome.storage.local.get(ADVANCE_PENDING_STORAGE_KEY);
  const pendingSince = pending[ADVANCE_PENDING_STORAGE_KEY];
  if (pendingSince === undefined) {
    return;
  }

  if (!isAdvancePendingFresh(pendingSince)) {
    await chrome.storage.local.remove(ADVANCE_PENDING_STORAGE_KEY);
    reportError("advance-request-expired", "Wand discarded a stale request to advance UDOIT.", latestFrameSnapshot?.remediation, {
      pendingSince,
    });
    postRemediationErrorToTop("Wand stopped a stale next-issue request so it would not advance the wrong review item. Bug code: advance-request-expired");
    return;
  }

  advanceInProgress = true;
  try {
    const previousRemediationSignature = getRemediationSignature(latestFrameSnapshot?.remediation);
    const advanced = await clickNextIssueWhenReady();
    await chrome.storage.local.remove(ADVANCE_PENDING_STORAGE_KEY);
    if (advanced) {
      await launchNextRemediation(previousRemediationSignature);
    }
  } finally {
    advanceInProgress = false;
  }
}

async function launchNextRemediation(previousSignature: string): Promise<void> {
  const nextRemediation = await waitFor(() => {
    const remediation = latestFrameSnapshot?.remediation;
    if (!remediation) {
      return null;
    }

    return getRemediationSignature(remediation) !== previousSignature ? remediation : null;
  }, 15000, 200);

  if (!nextRemediation) {
    reportError("next-remediation-not-detected", "Wand advanced UDOIT, but couldn't identify the next issue.", latestFrameSnapshot?.remediation, {
      previousSignature,
    });
    postRemediationErrorToTop("Wand advanced UDOIT, but couldn't identify the next issue. Close the Canvas workspace and reopen the current Review item. Bug code: next-remediation-not-detected");
    postActionStateToTop(false);
    return;
  }

  console.info("[wand] Launching next Canvas remediation.", {
    issueType: nextRemediation.issueType,
    sourceTitle: nextRemediation.sourceTitle,
    issueIndex: nextRemediation.issueIndex,
  });
  await startCurrentRemediation(nextRemediation);
}

function getRemediationSignature(remediation: Parameters<typeof startUdoitRemediation>[0] | undefined): string {
  if (!remediation) {
    return "";
  }

  return JSON.stringify({
    issueIndex: remediation.issueIndex,
    issueTotal: remediation.issueTotal,
    issueType: remediation.issueType,
    previewText: remediation.previewText,
    sourceTitle: remediation.sourceTitle,
  });
}

async function clickNextIssueWhenReady(): Promise<boolean> {
  console.info("[wand] Trying to advance UDOIT issue.", {
    url: window.location.href,
    hasDialog: Boolean(document.querySelector("[role='dialog']")),
  });

  await sleep(1000);

  const nextIssueBtn = await waitFor(() => getEnabledButton("Next Issue"), 15000, 200);
  if (!nextIssueBtn) {
    console.info("[wand] Next Issue button not found yet.", {
      url: window.location.href,
      buttons: Array.from(document.querySelectorAll<HTMLButtonElement>("button")).map((button) => normalize(button.textContent)).filter(Boolean).slice(0, 12),
    });
    reportError("next-issue-control-not-found", "Wand couldn't advance to the next UDOIT issue.", latestFrameSnapshot?.remediation, {
      buttons: Array.from(document.querySelectorAll<HTMLButtonElement>("button")).map((button) => normalize(button.textContent)).filter(Boolean).slice(0, 12),
    });
    postRemediationErrorToTop("Wand couldn't advance to the next UDOIT issue. Bug code: next-issue-control-not-found");
    return false;
  }

  console.info("[wand] Clicking Next Issue button.", {
    text: (nextIssueBtn.textContent || "").trim(),
  });
  realClick(nextIssueBtn);
  await sleep(1000);
  console.info("[wand] Advanced to next UDOIT issue.");
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

async function waitFor<T>(fn: () => T | null | undefined, timeout = 15000, interval = 200): Promise<T | null> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const val = fn();
    if (val) {
      return val;
    }

    await sleep(interval);
  }

  return null;
}

function getEnabledButton(label: string): HTMLButtonElement | null {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    !button.disabled && normalize(button.textContent) === label
  ) ?? null;
}
