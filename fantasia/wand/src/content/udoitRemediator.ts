import { getRemediationDefinition, PREPARE_WORKSPACE_MESSAGE, REMEDIATION_STORAGE_KEY, type PendingRemediation, type PrepareWorkspaceMessage } from "../shared/remediation";
import type { RemediationContext } from "../shared/types";
import { normalize } from "../shared/utils";
import { reportError } from "./diagnostics";
import { postActionStateToTop, postRemediationErrorToTop, postWorkspaceUrlToTop } from "./frameBridge";
import { getUdoitSourceControl, getUdoitSourceControlDiagnostics } from "./udoitControls";

const CAPTURE_SCRIPT_ID = "wand-window-open-capture-script";
const CAPTURE_REQUEST_MESSAGE = "wand:capture-next-window-open";
const CAPTURE_RESPONSE_MESSAGE = "wand:captured-window-open";

type SourceOpenResult = {
  route: "captured" | "background";
  url?: string;
};

let confirmWorkspaceOpen: (() => void) | null = null;

export function confirmUdoitWorkspaceOpened(): void {
  confirmWorkspaceOpen?.();
}

export async function startUdoitRemediation(context: RemediationContext): Promise<void> {
  postActionStateToTop(true, getRemediationDefinition(context.issueType)?.busyLabel ?? "Opening Canvas remediation…");
  try {
    const dialog = getVisibleDialog();
    const sourceControl = dialog ? getUdoitSourceControl(dialog, context.sourceTitle) : null;
    if (!dialog || !sourceControl) {
      failRemediation("source-control-not-found", "Wand couldn't find the Canvas source for this issue.", context, {
        candidates: dialog ? getUdoitSourceControlDiagnostics(dialog, context.sourceTitle) : [],
      });
      return;
    }

    const pendingRemediation: PendingRemediation = {
      ...context,
      createdAt: Date.now(),
    };

    await chrome.storage.local.set({
      [REMEDIATION_STORAGE_KEY]: pendingRemediation,
    });

    const message: PrepareWorkspaceMessage = {
      type: PREPARE_WORKSPACE_MESSAGE,
    };

    await chrome.runtime.sendMessage(message);
    const sourceOpenResult = await openSourceControl(sourceControl);
    if (!sourceOpenResult) {
      await chrome.storage.local.remove(REMEDIATION_STORAGE_KEY);
      failRemediation("canvas-url-not-captured", "Wand couldn't open the Canvas source for this issue.", context, {
        selectedControl: normalize(sourceControl.innerText || sourceControl.textContent),
      });
      return;
    }

    if (sourceOpenResult.url) {
      postWorkspaceUrlToTop(sourceOpenResult.url);
    }

    console.info("[wand] Remediation source verified.", {
      issueType: context.issueType,
      sourceTitle: context.sourceTitle,
      selectedControl: normalize(sourceControl.innerText || sourceControl.textContent),
      route: sourceOpenResult.route,
      canvasUrl: sourceOpenResult.url,
    });
  } catch (error) {
    await chrome.storage.local.remove(REMEDIATION_STORAGE_KEY);
    failRemediation("unexpected-start-error", "Wand couldn't start this remediation.", context, {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    postActionStateToTop(false);
  }
}

async function openSourceControl(sourceControl: HTMLElement): Promise<SourceOpenResult | null> {
  const captureInstalled = await installWindowOpenCapture();
  if (!captureInstalled) {
    return null;
  }

  const token = crypto.randomUUID();
  const sourceOpenResult = new Promise<SourceOpenResult | null>((resolve) => {
    let settled = false;

    const finish = (result: SourceOpenResult | null): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      confirmWorkspaceOpen = null;
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, 10000);

    const handleMessage = (event: MessageEvent): void => {
      if (event.source !== window || event.data?.type !== CAPTURE_RESPONSE_MESSAGE || event.data.token !== token) {
        return;
      }

      const url = toCanvasUrl(event.data.url);
      if (url) {
        finish({ route: "captured", url });
      }
    };

    confirmWorkspaceOpen = () => finish({ route: "background" });
    window.addEventListener("message", handleMessage);
  });

  window.postMessage({
    type: CAPTURE_REQUEST_MESSAGE,
    token,
  }, "*");

  sourceControl.click();
  return sourceOpenResult;
}

function installWindowOpenCapture(): Promise<boolean> {
  if (document.getElementById(CAPTURE_SCRIPT_ID)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = CAPTURE_SCRIPT_ID;
    script.src = chrome.runtime.getURL("windowOpenCapture.js");
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.documentElement.append(script);
  });
}

function getVisibleDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"));
  return dialogs.find((dialog) => {
    const rect = dialog.getBoundingClientRect();
    const style = window.getComputedStyle(dialog);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) ?? null;
}

function failRemediation(
  code: string,
  message: string,
  context: RemediationContext,
  details: Record<string, unknown> = {}
): void {
  reportError(code, message, context, details);
  postRemediationErrorToTop(`${message} Bug code: ${code}`);
}

function toCanvasUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) {
    return null;
  }

  try {
    const parsed = new URL(url, window.location.href);
    return /^https:\/\/[^/]+\.instructure\.com\//.test(parsed.href) ? parsed.href : null;
  } catch {
    return null;
  }
}
