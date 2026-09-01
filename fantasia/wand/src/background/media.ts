import { OPEN_MEDIA_PLATFORM_MESSAGE, type OpenMediaPlatformMessage } from "../shared/remediation";

export function initializeMediaPlatformRouting(): void {
  chrome.runtime.onMessage.addListener((message: Partial<OpenMediaPlatformMessage>, _sender, sendResponse) => {
    if (message.type !== OPEN_MEDIA_PLATFORM_MESSAGE || !isSafeMediaUrl(message.url)) {
      return false;
    }

    void chrome.tabs.create({ url: message.url })
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        console.error("[wand] Failed to open media platform.", error);
        sendResponse({ ok: false });
      });
    return true;
  });
}

function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
