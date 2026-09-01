const WAND_ENABLED_STORAGE_KEY = "wandEnabled";
const WAND_REFRESH_TABS_MESSAGE = "wand:refresh-tabs";
const WAND_RELOAD_EXTENSION_MESSAGE = "wand:reload-extension";

const enabledInput = getElement<HTMLInputElement>("wand-enabled");
const statusText = getElement<HTMLElement>("wand-status");
const reloadButton = getElement<HTMLButtonElement>("reload-wand");
const message = getElement<HTMLElement>("message");
const version = getElement<HTMLElement>("version");

void initializePopup();

async function initializePopup(): Promise<void> {
  version.textContent = `v${__APP_VERSION__}`;
  const settings = await chrome.storage.local.get(WAND_ENABLED_STORAGE_KEY);
  const enabled = settings[WAND_ENABLED_STORAGE_KEY] !== false;
  enabledInput.checked = enabled;
  updateStatus(enabled);

  enabledInput.addEventListener("change", () => {
    void setEnabled(enabledInput.checked);
  });

  reloadButton.addEventListener("click", () => {
    void reloadWand();
  });
}

async function setEnabled(enabled: boolean): Promise<void> {
  enabledInput.disabled = true;
  setMessage(enabled ? "Turning Wand on…" : "Turning Wand off…");

  try {
    await chrome.storage.local.set({ [WAND_ENABLED_STORAGE_KEY]: enabled });
    updateStatus(enabled);
    const response = await chrome.runtime.sendMessage({ type: WAND_REFRESH_TABS_MESSAGE }) as { ok?: boolean } | undefined;
    if (response?.ok !== true) {
      throw new Error("Supported tabs did not refresh.");
    }
    setMessage(enabled ? "Wand is on." : "Wand is off.");
  } catch (error) {
    enabledInput.checked = !enabled;
    updateStatus(!enabled);
    setMessage("Wand couldn't update this setting.", true);
    console.error("[wand] Failed to update enabled state.", error);
  } finally {
    enabledInput.disabled = false;
  }
}

async function reloadWand(): Promise<void> {
  reloadButton.disabled = true;
  enabledInput.disabled = true;
  setMessage("Reloading Wand and open course pages…");

  try {
    await chrome.runtime.sendMessage({ type: WAND_RELOAD_EXTENSION_MESSAGE });
  } catch (error) {
    setMessage("Wand couldn't reload itself.", true);
    reloadButton.disabled = false;
    enabledInput.disabled = false;
    console.error("[wand] Failed to request extension reload.", error);
  }
}

function updateStatus(enabled: boolean): void {
  statusText.textContent = enabled
    ? "Active on supported pages"
    : "Paused on UDOIT and Canvas pages";
}

function setMessage(text: string, isError = false): void {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing popup element: ${id}`);
  }
  return element as T;
}
