import { getFilenameLabelSuggestion } from "../shared/filenameLabel";
import type { RemediationContext } from "../shared/types";
import { normalize } from "../shared/utils";
import { reportError } from "./diagnostics";
import { postActionStateToTop, postActionSuccessToTop, postRemediationErrorToTop } from "./frameBridge";
import { getInputLabel, getVisibleDialog, isVisible, setInputValue, TEXT_INPUT_SELECTOR } from "./udoitTextInput";

export async function improveUdoitImageAltText(context: RemediationContext): Promise<void> {
  postActionStateToTop(true, "Improving alternative text…");
  try {
    const dialog = getVisibleDialog();
    const input = dialog ? getAlternativeTextInput(dialog) : null;
    if (!input) {
      failImageAltRemediation("alt-input-not-found", "Wand couldn't find UDOIT's alternative-text field.", context);
      return;
    }

    const original = input.value || input.getAttribute("value") || "";
    const suggestion = getFilenameLabelSuggestion(original);
    if (!suggestion) {
      failImageAltRemediation("no-safe-alt-suggestion", "Wand couldn't create an alternative-text suggestion from this filename.", context, { original });
      return;
    }

    input.focus();
    input.select();
    setInputValue(input, suggestion);
    input.setSelectionRange(suggestion.length, suggestion.length);
    input.blur();

    if (input.value !== suggestion) {
      failImageAltRemediation("alt-input-update-failed", "Wand couldn't update UDOIT's alternative-text field.", context, {
        original,
        expected: suggestion,
        actual: input.value,
      });
      return;
    }

    console.info("[wand] Alternative-text suggestion applied.", {
      issueType: context.issueType,
      original,
      suggestion,
    });
    postActionSuccessToTop("Suggested alternative text was applied. Review it before saving.");
  } finally {
    postActionStateToTop(false);
  }
}

function getAlternativeTextInput(dialog: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  const ranked = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_INPUT_SELECTOR))
    .filter((input) => !input.disabled && !input.readOnly && isVisible(input))
    .map((input) => ({ input, score: scoreAlternativeTextInput(input) }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score >= 80 ? ranked[0].input : null;
}

function scoreAlternativeTextInput(input: HTMLInputElement | HTMLTextAreaElement): number {
  const id = normalize(input.id).toLowerCase();
  const name = normalize(input.getAttribute("name")).toLowerCase();
  const label = getInputLabel(input).toLowerCase();
  const context = normalize(input.parentElement?.innerText || input.parentElement?.textContent).toLowerCase();
  let score = 0;

  if (id === "alttextinput" || name === "alttextinput") {
    score += 140;
  }
  if (label.includes("alternative text") || label.includes("alt text")) {
    score += 120;
  }
  if (context.includes("edit alternative text")) {
    score += 80;
  }
  return score;
}

function failImageAltRemediation(
  code: string,
  message: string,
  context: RemediationContext,
  details: Record<string, unknown> = {}
): void {
  reportError(code, message, context, details);
  postRemediationErrorToTop(`${message} Bug code: ${code}`);
}
