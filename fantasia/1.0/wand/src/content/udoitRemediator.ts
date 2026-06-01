import { PREPARE_WORKSPACE_MESSAGE, REMEDIATION_STORAGE_KEY, type PendingRemediation, type PrepareWorkspaceMessage } from "../shared/remediation";
import type { RemediationContext } from "../shared/types";
import { normalize } from "../shared/utils";
import { postWorkspaceUrlToTop } from "./frameBridge";

const FOUND_IN_LABEL = "Found in:";
const CAPTURE_SCRIPT_ID = "wand-window-open-capture-script";
const CAPTURE_REQUEST_MESSAGE = "wand:capture-next-window-open";
const CAPTURE_RESPONSE_MESSAGE = "wand:captured-window-open";

export async function startUdoitRemediation(context: RemediationContext): Promise<void> {
  const sourceButton = getSourceButton(context.sourceTitle);
  if (!sourceButton) {
    console.info("[wand] Could not find UFIXIT source button.", context);
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
  const capturedUrl = await captureSourceButtonUrl(sourceButton);
  if (capturedUrl) {
    postWorkspaceUrlToTop(capturedUrl);
  }
}

function getSourceButton(sourceTitle: string): HTMLButtonElement | null {
  const dialog = document.querySelector<HTMLElement>("[role='dialog']");
  if (!dialog) {
    return null;
  }

  const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
  const sourceButton = buttons.find((button) => normalize(button.innerText || button.textContent).includes(sourceTitle));
  if (sourceButton) {
    return sourceButton;
  }

  return buttons.find((button) => {
    const containerText = normalize(button.closest("span")?.parentElement?.innerText || button.closest("div")?.innerText);
    return containerText.includes(FOUND_IN_LABEL);
  }) ?? null;
}

async function captureSourceButtonUrl(sourceButton: HTMLButtonElement): Promise<string | null> {
  await installWindowOpenCapture();

  const token = crypto.randomUUID();
  const capturedUrl = new Promise<string | null>((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      resolve(null);
    }, 10000);

    const handleMessage = (event: MessageEvent): void => {
      if (event.source !== window || event.data?.type !== CAPTURE_RESPONSE_MESSAGE || event.data.token !== token) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      const url = toCanvasUrl(event.data.url);
      resolve(url);
    };

    window.addEventListener("message", handleMessage);
  });

  window.postMessage({
    type: CAPTURE_REQUEST_MESSAGE,
    token,
  }, "*");

  sourceButton.click();
  return capturedUrl;
}

function installWindowOpenCapture(): Promise<void> {
  if (document.getElementById(CAPTURE_SCRIPT_ID)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = CAPTURE_SCRIPT_ID;
    script.src = chrome.runtime.getURL("windowOpenCapture.js");
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.documentElement.append(script);
  });
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
