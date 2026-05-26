import { normalize } from "../shared/utils";

export function initializeHandlers(): void {
  document.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const label = normalize(target.textContent);
    if (!label) return;
  });
}
