import { initializeCanvasHighlighter } from "./canvasHighlighter";
import { initializeDevReload } from "./devReload";
import { isTopFrame, listenForCanvasSaved, listenForFrameCommands, listenForFrameSnapshots, listenForWorkspaceUrls, postCommandToFrames, postSnapshotToTop } from "./frameBridge";
import { initializeHandlers } from "./handlers";
import { createPanel, updatePanelSnapshot } from "./panel";
import { initializeUdoitDetector } from "./udoitDetector";
import { startUdoitRemediation } from "./udoitRemediator";
import { closeWorkspace, initializeWorkspace, openWorkspace } from "./workspace";
import { wandConfig } from "../shared/config";
import { ADVANCE_PENDING_STORAGE_KEY, REMEDIATION_STORAGE_KEY } from "../shared/remediation";
import { normalize } from "../shared/utils";

const topFrame = isTopFrame();
let advanceInProgress = false;
let latestFrameSnapshot = null as Parameters<typeof postSnapshotToTop>[0] | null;

console.info("[wand] Content script loaded.", {
  topFrame,
  url: window.location.href,
});

initializeDevReload();
initializeHandlers();
void initializeCanvasHighlighter();
initializeWorkspace();

const panel = wandConfig.features.panel && topFrame ? createPanel(() => {
  postCommandToFrames({ type: "start-remediation" });
}) : null;

if (panel) {
  listenForWorkspaceUrls((url) => {
    openWorkspace(url);
  });

  listenForCanvasSaved(() => {
    console.info("[wand] Canvas save signal received in top frame.", {
      url: window.location.href,
      hasDialog: Boolean(document.querySelector("[role='dialog']")),
    });
    void chrome.storage.local.set({
      [ADVANCE_PENDING_STORAGE_KEY]: Date.now(),
    });
    void chrome.storage.local.remove(REMEDIATION_STORAGE_KEY);
    closeWorkspace();
    postCommandToFrames({ type: "advance-remediation" });
  });

  listenForFrameSnapshots((snapshot) => {
    updatePanelSnapshot(panel, snapshot);
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
      void startUdoitRemediation(latestFrameSnapshot.remediation);
    }

    if (command.type === "advance-remediation" && (latestFrameSnapshot?.pageKind === "udoit" || window.location.hostname === "udoit3.ciditools.com")) {
      void consumePendingAdvance();
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
  if (!pending[ADVANCE_PENDING_STORAGE_KEY]) {
    return;
  }

  advanceInProgress = true;
  try {
    const previousRemediationSignature = getRemediationSignature(latestFrameSnapshot?.remediation);
    const advanced = await clickNextIssueWhenReady();
    if (advanced) {
      await chrome.storage.local.remove(ADVANCE_PENDING_STORAGE_KEY);
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
    console.info("[wand] Advanced UDOIT issue, but no next remediation became available.");
    return;
  }

  console.info("[wand] Launching next Canvas remediation.", {
    issueType: nextRemediation.issueType,
    sourceTitle: nextRemediation.sourceTitle,
    issueIndex: nextRemediation.issueIndex,
  });
  await startUdoitRemediation(nextRemediation);
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
