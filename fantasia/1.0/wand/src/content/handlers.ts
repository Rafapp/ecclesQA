import { normalize } from "../shared/utils";
import { postCanvasSavedToTop } from "./frameBridge";

let lastCanvasSavePostAt = 0;

export function initializeHandlers(): void {
  const handleSaveInteraction = (event: Event, source: string): void => {
    if (!isCanvasContentPage()) return;

    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const saveControl = getSaveControl(target);
    if (!saveControl) return;

    if (!postCanvasSaveOnce()) return;

    console.info(`[wand] Canvas save ${source}.`, {
      url: window.location.href,
      topFrame: window.top === window,
      text: getControlLabel(saveControl),
    });
    postCanvasSavedToTop();
  };

  document.addEventListener("click", (event) => {
    handleSaveInteraction(event, "button clicked");
  }, true);

  document.addEventListener("pointerup", (event) => {
    handleSaveInteraction(event, "pointerup");
  }, true);

  document.addEventListener("submit", (event) => {
    if (!isCanvasContentPage()) return;

    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) return;

    const submitter = (event as SubmitEvent).submitter;
    const saveControl = submitter instanceof HTMLElement ? getSaveControl(submitter) : getFormSaveControl(form);
    if (!saveControl) return;

    if (!postCanvasSaveOnce()) return;

    console.info("[wand] Canvas save form submitted.", {
      url: window.location.href,
      topFrame: window.top === window,
      text: getControlLabel(saveControl),
    });
    postCanvasSavedToTop();
  }, true);
}

function isCanvasContentPage(): boolean {
  return window.location.hostname.endsWith(".instructure.com") && !/\/external_tools\//.test(window.location.pathname);
}

function getSaveControl(target: HTMLElement): HTMLElement | null {
  const control = target.closest<HTMLElement>("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']");
  if (!control || isDisabled(control)) {
    return null;
  }

  return isSaveControl(control) ? control : null;
}

function getFormSaveControl(form: HTMLFormElement): HTMLElement | null {
  const controls = Array.from(form.querySelectorAll<HTMLElement>("button, input[type='submit'], input[type='button'], a[role='button'], a.btn, [role='button']"));
  return controls.find((control) => !isDisabled(control) && isSaveControl(control)) ?? null;
}

function isSaveControl(control: HTMLElement): boolean {
  if (control.classList.contains("save_quiz_button")) {
    return true;
  }

  return /^(save|update)(\b|$)/i.test(getControlLabel(control));
}

function getControlLabel(control: HTMLElement): string {
  if (control instanceof HTMLInputElement) {
    return normalize(control.value || control.getAttribute("aria-label") || control.title);
  }

  return normalize(control.innerText || control.textContent || control.getAttribute("aria-label") || control.title);
}

function isDisabled(control: HTMLElement): boolean {
  if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
    return control.disabled;
  }

  return control.getAttribute("aria-disabled") === "true";
}

function postCanvasSaveOnce(): boolean {
  const now = Date.now();
  if (now - lastCanvasSavePostAt < 1500) {
    return false;
  }

  lastCanvasSavePostAt = now;
  return true;
}
