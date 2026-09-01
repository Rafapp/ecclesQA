const WAND_REFRESH_TABS_MESSAGE = "wand:refresh-tabs";
const WAND_RELOAD_EXTENSION_MESSAGE = "wand:reload-extension";
const WAND_RELOAD_PENDING_STORAGE_KEY = "wandReloadPending";
const WAND_TAB_URLS = [
  "https://udoit3.ciditools.com/*",
  "https://*.instructure.com/*",
];

type ReloadRequest = {
  type?: string;
};

export function initializeExtensionReload(): void {
  void refreshTabsAfterExtensionReload();

  chrome.runtime.onMessage.addListener((message: ReloadRequest, _sender, sendResponse) => {
    if (message?.type === WAND_RELOAD_EXTENSION_MESSAGE) {
      void reloadExtension();
      return false;
    }

    if (message?.type === WAND_REFRESH_TABS_MESSAGE) {
      void refreshWandTabs()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          console.error("[wand] Failed to refresh supported tabs.", error);
          sendResponse({ ok: false });
        });
      return true;
    }

    return false;
  });
}

async function reloadExtension(): Promise<void> {
  await chrome.storage.local.set({
    [WAND_RELOAD_PENDING_STORAGE_KEY]: Date.now(),
  });
  chrome.runtime.reload();
}

async function refreshTabsAfterExtensionReload(): Promise<void> {
  const pendingReload = await chrome.storage.local.get(WAND_RELOAD_PENDING_STORAGE_KEY);
  if (!pendingReload[WAND_RELOAD_PENDING_STORAGE_KEY]) {
    return;
  }

  await chrome.storage.local.remove(WAND_RELOAD_PENDING_STORAGE_KEY);
  await refreshWandTabs();
}

async function refreshWandTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: WAND_TAB_URLS });
  await Promise.all(tabs.map(async (tab) => {
    if (typeof tab.id === "number") {
      await chrome.tabs.reload(tab.id);
    }
  }));
}
