import { copyText, createFeedbackDraft, createFeedbackId, formatFeedbackDraft, getFeedbackDrafts, getRecentDiagnostics, saveFeedbackDraft, type FeedbackKind } from "../shared/feedback";

const WAND_ENABLED_STORAGE_KEY = "wandEnabled";
const WAND_REFRESH_TABS_MESSAGE = "wand:refresh-tabs";
const WAND_RELOAD_EXTENSION_MESSAGE = "wand:reload-extension";

const enabledInput = getElement<HTMLInputElement>("wand-enabled");
const statusText = getElement<HTMLElement>("wand-status");
const reloadButton = getElement<HTMLButtonElement>("reload-wand");
const message = getElement<HTMLElement>("message");
const version = getElement<HTMLElement>("version");
const feedbackChoices = getElement<HTMLElement>("feedback-choices");
const feedbackForm = getElement<HTMLFormElement>("feedback-form");
const feedbackFormTitle = getElement<HTMLElement>("feedback-form-title");
const feedbackSummary = getElement<HTMLInputElement>("feedback-summary");
const feedbackDetails = getElement<HTMLTextAreaElement>("feedback-details");
const feedbackDiagnostics = getElement<HTMLInputElement>("feedback-diagnostics");
const feedbackCancel = getElement<HTMLButtonElement>("feedback-cancel");
const feedbackSubmit = getElement<HTMLButtonElement>("feedback-submit");
const exportFeedback = getElement<HTMLButtonElement>("export-feedback");
const draftCount = getElement<HTMLElement>("draft-count");
let feedbackKind: FeedbackKind = "bug";

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

  feedbackChoices.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-feedback-kind]") : null;
    const kind = target?.dataset.feedbackKind;
    if (kind === "bug" || kind === "suggestion") {
      openFeedbackForm(kind);
    }
  });

  feedbackCancel.addEventListener("click", closeFeedbackForm);
  feedbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitFeedback();
  });
  exportFeedback.addEventListener("click", () => {
    void exportSavedFeedback();
  });
  await updateDraftCount();
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

function openFeedbackForm(kind: FeedbackKind): void {
  feedbackKind = kind;
  feedbackFormTitle.textContent = kind === "bug" ? "Report a Wand bug" : "Suggest a Wand improvement";
  feedbackDiagnostics.checked = kind === "bug";
  feedbackChoices.hidden = true;
  feedbackForm.hidden = false;
  feedbackSummary.focus();
}

function closeFeedbackForm(): void {
  feedbackForm.hidden = true;
  feedbackChoices.hidden = false;
  feedbackForm.reset();
}

async function submitFeedback(): Promise<void> {
  feedbackSubmit.disabled = true;
  setMessage("Preparing report…");
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const draft = createFeedbackDraft({
      id: createFeedbackId(),
      kind: feedbackKind,
      summary: feedbackSummary.value,
      details: feedbackDetails.value,
      pageUrl: activeTab?.url,
      appVersion: __APP_VERSION__,
      createdAt: Date.now(),
      diagnostics: await getRecentDiagnostics(feedbackDiagnostics.checked),
    });
    if (!draft.summary || !draft.details) {
      setMessage("Please add both a summary and details.", true);
      return;
    }

    await saveFeedbackDraft(draft);
    const copied = await copyText(formatFeedbackDraft(draft));
    closeFeedbackForm();
    await updateDraftCount();
    setMessage(copied ? "Report saved and copied." : "Report saved locally.");
  } catch (error) {
    setMessage("Wand couldn't save this report.", true);
    console.error("[wand] Failed to save feedback draft.", error);
  } finally {
    feedbackSubmit.disabled = false;
  }
}

async function updateDraftCount(): Promise<void> {
  const drafts = await getFeedbackDrafts();
  draftCount.textContent = drafts.length ? `${drafts.length} saved` : "";
  exportFeedback.hidden = drafts.length === 0;
}

async function exportSavedFeedback(): Promise<void> {
  const drafts = await getFeedbackDrafts();
  if (!drafts.length) {
    setMessage("No saved reports yet.");
    return;
  }

  const blob = new Blob([JSON.stringify(drafts, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `wand-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage(`Exported ${drafts.length} saved report${drafts.length === 1 ? "" : "s"}.`);
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
