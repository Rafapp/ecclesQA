import { getLinkTextSuggestion } from "../shared/linkText";
import type { RemediationContext } from "../shared/types";
import { normalize } from "../shared/utils";
import { postActionStateToTop, postActionSuccessToTop, postRemediationErrorToTop } from "./frameBridge";
import { getInputLabel, getVisibleDialog, isVisible, setInputValue, TEXT_INPUT_SELECTOR } from "./udoitTextInput";

export async function improveUdoitLinkText(context: RemediationContext): Promise<void> {
  postActionStateToTop(true, "Improving link text…");
  try {
    const dialog = getVisibleDialog();
    const input = dialog ? getLinkTextInput(dialog) : null;
    if (!input) {
      failLinkRemediation("link-input-not-found", "Wand couldn't find UDOIT's New Link Text field.", context);
      return;
    }

    const original = input.value || input.getAttribute("value") || "";
    const suggestion = getLinkTextSuggestion(original);
    if (!suggestion) {
      failLinkRemediation("no-safe-link-suggestion", "Wand couldn't create a safe link-text suggestion from this value.", context, { original });
      return;
    }

    input.focus();
    input.select();
    setInputValue(input, suggestion);
    input.setSelectionRange(suggestion.length, suggestion.length);
    input.blur();

    if (input.value !== suggestion) {
      failLinkRemediation("link-input-update-failed", "Wand couldn't update UDOIT's New Link Text field.", context, {
        original,
        expected: suggestion,
        actual: input.value,
      });
      return;
    }

    console.info("[wand] Link text suggestion applied.", {
      issueType: context.issueType,
      original,
      suggestion,
    });
    postActionSuccessToTop("Suggested link text was applied. Review it before saving.");
  } finally {
    postActionStateToTop(false);
  }
}

function getLinkTextInput(dialog: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_INPUT_SELECTOR));
  const ranked = inputs
    .filter((input) => !input.disabled && !input.readOnly && isVisible(input))
    .map((input) => ({ input, score: scoreLinkTextInput(input) }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score >= 50 ? ranked[0].input : null;
}

function scoreLinkTextInput(input: HTMLInputElement | HTMLTextAreaElement): number {
  const id = normalize(input.id).toLowerCase();
  const name = normalize(input.getAttribute("name")).toLowerCase();
  const label = getInputLabel(input).toLowerCase();
  const context = normalize(input.parentElement?.innerText || input.parentElement?.textContent).toLowerCase();
  let score = 0;

  if (id === "textinputvalue" || name === "textinputvalue") {
    score += 120;
  }
  if (label.includes("new link text")) {
    score += 100;
  }
  if (context.includes("new link text")) {
    score += 50;
  }
  if (input instanceof HTMLTextAreaElement) {
    score += 10;
  }
  return score;
}

function failLinkRemediation(
  code: string,
  message: string,
  context: RemediationContext,
  details: Record<string, unknown> = {}
): void {
  console.error("[wand] Link remediation failed.", {
    code,
    issueType: context.issueType,
    sourceTitle: context.sourceTitle,
    ...details,
  });
  postRemediationErrorToTop(message);
}
