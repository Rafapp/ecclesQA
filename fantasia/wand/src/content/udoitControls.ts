import { normalize } from "../shared/utils";

const FOUND_IN_PATTERN = /\bfound in\s*:/i;
const HELP_CONTROL_PATTERN = /\b(ulearn|accessibility guide|learn more)\b/i;
const GENERIC_CONTROL_PATTERN = /^(close|save|previous issue|next issue|html|expand preview|manual resolution)$/i;

type RankedControl = {
  control: HTMLElement;
  label: string;
  score: number;
};

export function getUdoitSourceControl(dialog: HTMLElement, sourceTitle = ""): HTMLElement | null {
  const ranked = getRankedSourceControls(dialog, sourceTitle);
  return ranked[0]?.score >= 60 ? ranked[0].control : null;
}

export function getUdoitSourceTitle(dialog: HTMLElement): string {
  const ranked = getRankedSourceControls(dialog, "");
  return ranked[0]?.score >= 60 ? ranked[0].label : "";
}

export function getUdoitSourceControlDiagnostics(dialog: HTMLElement, sourceTitle: string): Array<{ label: string; score: number }> {
  return getRankedSourceControls(dialog, sourceTitle).map(({ label, score }) => ({ label, score }));
}

function getRankedSourceControls(dialog: HTMLElement, sourceTitle: string): RankedControl[] {
  const normalizedTitle = normalize(sourceTitle).toLowerCase();
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button, [role='button']"));

  return controls
    .map((control) => rankSourceControl(control, normalizedTitle))
    .filter((candidate): candidate is RankedControl => Boolean(candidate))
    .sort((left, right) => right.score - left.score);
}

function rankSourceControl(control: HTMLElement, sourceTitle: string): RankedControl | null {
  const label = getControlLabel(control);
  if (!label || isExcludedControl(control, label)) {
    return null;
  }

  const normalizedLabel = label.toLowerCase();
  let score = 0;

  if (sourceTitle && normalizedLabel === sourceTitle) {
    score += 140;
  } else if (sourceTitle && (normalizedLabel.includes(sourceTitle) || sourceTitle.includes(normalizedLabel))) {
    score += 90;
  }

  const contextDistance = getFoundInContextDistance(control, dialogRoot(control));
  if (contextDistance !== null) {
    score += 120 - contextDistance * 10;
  }

  if (/\b(page|assignment|discussion|quiz|module|syllabus|announcement)\b/i.test(label)) {
    score += 10;
  }

  return { control, label, score };
}

function getControlLabel(control: HTMLElement): string {
  return normalize(
    control.innerText ||
    control.textContent ||
    control.getAttribute("aria-label") ||
    control.title
  );
}

function isExcludedControl(control: HTMLElement, label: string): boolean {
  if (GENERIC_CONTROL_PATTERN.test(label) || HELP_CONTROL_PATTERN.test(label)) {
    return true;
  }

  if (control.getAttribute("data-popover-trigger") === "true") {
    return true;
  }

  return Boolean(control.querySelector("svg[name='IconInfo']"));
}

function getFoundInContextDistance(control: HTMLElement, boundary: HTMLElement): number | null {
  let element: HTMLElement | null = control;
  let distance = 0;

  while (element && distance <= 5) {
    const text = normalize(element.innerText || element.textContent);
    if (FOUND_IN_PATTERN.test(text) && text.length <= 500) {
      return distance;
    }

    if (element === boundary) {
      break;
    }

    element = element.parentElement;
    distance++;
  }

  return null;
}

function dialogRoot(control: HTMLElement): HTMLElement {
  return control.closest<HTMLElement>("[role='dialog']") ?? control.parentElement ?? control;
}
