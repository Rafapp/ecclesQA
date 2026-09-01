import { normalize } from "../shared/utils";

export const TEXT_INPUT_SELECTOR = "textarea, input[type='text'], input:not([type])";

export function getVisibleDialog(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']")).find(isVisible) ?? null;
}

export function getInputLabel(input: HTMLInputElement | HTMLTextAreaElement): string {
  const explicitLabel = input.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`)
    : null;
  return normalize(
    explicitLabel?.innerText ||
    explicitLabel?.textContent ||
    input.getAttribute("aria-label") ||
    input.getAttribute("placeholder")
  );
}

export function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }

  input.setAttribute("value", value);
  input.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    composed: true,
    data: value,
    inputType: "insertText",
  }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

export function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}
