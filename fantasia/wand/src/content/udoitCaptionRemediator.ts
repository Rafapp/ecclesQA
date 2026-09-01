import { normalize } from "../shared/utils";
import { postActionStateToTop, postActionSuccessToTop, postRemediationErrorToTop } from "./frameBridge";
import { isVisible } from "./udoitTextInput";

const CAPTION_REFRESH_PATTERN = /^(?:scan video for caption updates|check captions again|refresh caption(?:ing)? status)$/i;

export async function refreshUdoitCaptionStatus(): Promise<void> {
  postActionStateToTop(true, "Checking captions again…");
  try {
    const control = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button']"))
      .find((candidate) => isVisible(candidate) && CAPTION_REFRESH_PATTERN.test(normalize(candidate.innerText || candidate.textContent)));
    if (!control || control.getAttribute("aria-disabled") === "true" || control instanceof HTMLButtonElement && control.disabled) {
      postRemediationErrorToTop("Wand couldn't find UDOIT's caption refresh control. Please flag this to the team.");
      return;
    }

    control.click();
    await wait(800);
    postActionSuccessToTop("UDOIT is checking the video captions again.");
  } finally {
    postActionStateToTop(false);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
