const DEV_RELOAD_MODE = "development";
const DEV_RELOAD_MESSAGE = "wand:dev-reload-extension";
const DEV_RELOAD_STORAGE_KEY = "wandDevReloadPending";
const DEV_RELOAD_TAB_URLS = [
  "https://udoit3.ciditools.com/*",
  "https://*.instructure.com/*",
];

type ImportMetaWithEnv = ImportMeta & {
  env?: {
    MODE?: string;
  };
};

type DevReloadRequest = {
  type?: string;
};

export function initializeBackgroundDevReload(): void {
  if (getMode() !== DEV_RELOAD_MODE) {
    return;
  }

  void refreshTabsAfterExtensionReload();

  chrome.runtime.onMessage.addListener((message: DevReloadRequest) => {
    if (message?.type !== DEV_RELOAD_MESSAGE) {
      return false;
    }

    void reloadExtension();
    return false;
  });
}

async function reloadExtension(): Promise<void> {
  await chrome.storage.local.set({
    [DEV_RELOAD_STORAGE_KEY]: Date.now(),
  });

  chrome.runtime.reload();
}

async function refreshTabsAfterExtensionReload(): Promise<void> {
  const pendingReload = await chrome.storage.local.get(DEV_RELOAD_STORAGE_KEY);
  if (!pendingReload[DEV_RELOAD_STORAGE_KEY]) {
    return;
  }

  await chrome.storage.local.remove(DEV_RELOAD_STORAGE_KEY);

  const tabs = await chrome.tabs.query({
    url: DEV_RELOAD_TAB_URLS,
  });

  await Promise.all(tabs.map((tab) => reloadTab(tab)));
}

async function reloadTab(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof tab.id !== "number") {
    return;
  }

  await chrome.tabs.reload(tab.id);
}

function getMode(): string {
  return (import.meta as ImportMetaWithEnv).env?.MODE ?? "production";
}
