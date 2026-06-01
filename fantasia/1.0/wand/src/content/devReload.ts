const DEV_RELOAD_MODE = "development";
const DEV_RELOAD_URL = "http://127.0.0.1:5174/events";
const DEV_RELOAD_MESSAGE = "wand:dev-reload-extension";

let devReloadSource: EventSource | null = null;
let reportedDisconnect = false;

type ImportMetaWithEnv = ImportMeta & {
  env?: {
    MODE?: string;
  };
};

export function initializeDevReload(): void {
  if (getMode() !== DEV_RELOAD_MODE || devReloadSource) {
    return;
  }

  devReloadSource = new EventSource(DEV_RELOAD_URL);

  devReloadSource.addEventListener("open", () => {
    reportedDisconnect = false;
    console.info("[wand] Dev reload connected.");
  });

  devReloadSource.addEventListener("error", () => {
    if (reportedDisconnect) {
      return;
    }

    reportedDisconnect = true;
    console.info("[wand] Waiting for dev reload server...");
  });

  devReloadSource.addEventListener("reload", () => {
    void chrome.runtime.sendMessage({ type: DEV_RELOAD_MESSAGE }).catch(() => {
      window.location.reload();
    });
  });
}

function getMode(): string {
  return (import.meta as ImportMetaWithEnv).env?.MODE ?? "production";
}
