import { POLL_INTERVAL_MS } from "../shared/config";
import { isSupportedRemediation } from "../shared/remediation";
import type { IssueSummary, PageKind, PageSnapshot } from "../shared/types";
import { normalize } from "../shared/utils";
import { getUdoitSourceTitle } from "./udoitControls";

const ROW_SELECTOR = "tbody tr, [role='row']";
const COUNTER_SELECTOR = "li, [role='status'], [aria-live], [class*='pagination' i], [class*='counter' i]";
const ISSUE_TEXT_PATTERN = /\b(issue|error|warning|alt text|alternative text|heading|link text|caption|table|color|contrast|bold|underline|list|image|video)\b/i;
const EMPTY_STATE_PATTERN = /\b(0|no)\s+(issues?|errors?|warnings?)\b|\bno accessibility issues\b/i;
const SCORECARD_CATEGORY_PATTERN = /\b(page headings|pdf|links|color|video captions|excel|images|ms word)\b/i;
const ISSUE_COUNTER_PATTERN = /\b(?:issue|file)\s+\d+\s+of\s+(\d+)\b/i;
const PAGINATION_COUNTER_PATTERN = /\b\d+\s*[-–]\s*\d+\s+of\s+(\d+)\b/i;
const TOTAL_ISSUES_PATTERN = /\b(\d+)\s+(?:issues?|errors?|warnings?)\b/i;
const ISSUE_COUNTER_DETAIL_PATTERN = /\bIssue\s+(\d+)\s+of\s+(\d+)\b/i;
const REMEDIATION_DIALOG_PATTERN = /\bfound in\s*:/i;
const MAX_ISSUES = 20;

let observer: MutationObserver | null = null;
let scanTimer = 0;
let lastSignature = "";

export function initializeUdoitDetector(onSnapshot: (snapshot: PageSnapshot) => void): void {
  const scan = (): void => {
    const snapshot = getPageSnapshot();
    const signature = getSnapshotSignature(snapshot);

    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;
    console.info("[wand] Detector snapshot", snapshot);
    onSnapshot(snapshot);
  };

  scan();

  observer?.disconnect();
  observer = new MutationObserver(() => {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, POLL_INTERVAL_MS);
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });
}

function getPageSnapshot(): PageSnapshot {
  const pageKind = getPageKind();
  const dialog = pageKind === "udoit" ? getVisibleDialog() : null;
  const activeIssueType = dialog ? getModalIssueType(dialog) : undefined;
  const remediation = dialog && activeIssueType && isSupportedRemediation(activeIssueType)
    ? getRemediationContext(dialog, activeIssueType)
    : undefined;
  const udoitView = pageKind === "udoit" ? getUdoitView(dialog) : undefined;
  const issues = pageKind === "udoit" ? getVisibleIssues(remediation) : [];
  const detectedCount = pageKind === "udoit" ? getDetectedIssueCount(issues) : 0;

  return {
    pageKind,
    udoitView,
    activeIssueType,
    issueCount: detectedCount,
    issues,
    remediation,
    url: window.location.href,
    observedAt: Date.now(),
  };
}

function getPageKind(): PageKind {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname === "udoit3.ciditools.com") {
    return "udoit";
  }

  if (hostname.endsWith(".instructure.com")) {
    return "canvas";
  }

  return "unknown";
}

function getVisibleIssues(remediation: PageSnapshot["remediation"]): IssueSummary[] {
  if (remediation) {
    return [{
      label: `${remediation.sourceTitle} - ${remediation.issueType}`,
      source: "fixModal",
    }];
  }

  const scorecardIssues = getScorecardIssues();
  if (scorecardIssues.length) {
    return scorecardIssues;
  }

  const elements = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  const issues: IssueSummary[] = [];
  const labels = new Set<string>();

  for (const element of elements) {
    if (issues.length >= MAX_ISSUES) {
      break;
    }

    if (!isVisible(element) || isInsideWandPanel(element)) {
      continue;
    }

    const label = getIssueLabel(element);
    if (!label || labels.has(label) || !isIssueRow(label)) {
      continue;
    }

    labels.add(label);
    issues.push({
      label,
      source: getElementSource(element),
    });
  }

  return issues;
}

function getUdoitView(dialog: HTMLElement | null): "scorecard" | "issueList" | "fixModal" | "unknown" {
  if (dialog) {
    return "fixModal";
  }

  if (hasReviewAction()) {
    return "issueList";
  }

  if (getScorecardTable()) {
    return "scorecard";
  }

  if (document.querySelector("tbody tr button")) {
    return "issueList";
  }

  return "unknown";
}

function getRemediationContext(dialog: HTMLElement, issueType: string) {
  const sourceTitle = getModalSourceTitle(dialog);
  const previewText = getModalPreviewText(dialog);
  const { issueIndex, issueTotal } = getModalIssueCounter(dialog);
  if (!sourceTitle) {
    return undefined;
  }

  return {
    issueType,
    sourceTitle,
    sourceKind: getModalSourceKind(dialog),
    issueIndex,
    issueTotal,
    previewText,
  };
}

function getModalIssueType(dialog: HTMLElement): string {
  const headings = Array.from(dialog.querySelectorAll<HTMLElement>("h1, h2, h3, [data-cid='Heading']"))
    .map((element) => normalize(element.innerText || element.textContent))
    .filter(Boolean);

  const textCandidates = Array.from(dialog.querySelectorAll<HTMLElement>("span, p"))
    .map((element) => normalize(element.innerText || element.textContent))
    .filter(Boolean);

  const candidates = [...headings, ...textCandidates];
  const supportedIssue = candidates.find(isSupportedRemediation);
  if (supportedIssue) {
    return supportedIssue;
  }

  return candidates.find(isLikelyIssueType) ?? "";
}

function getVisibleDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"));
  return dialogs.find((dialog) =>
    isVisible(dialog) && REMEDIATION_DIALOG_PATTERN.test(normalize(dialog.innerText || dialog.textContent))
  ) ?? null;
}

function isLikelyIssueType(text: string): boolean {
  if (text.length < 8 || text.length > 240) {
    return false;
  }

  if (/^(review|ufixit|manual resolution|html|expand preview|issue \d+ of \d+)$/i.test(text)) {
    return false;
  }

  return ISSUE_TEXT_PATTERN.test(text);
}

function getModalSourceTitle(dialog: HTMLElement): string {
  return getUdoitSourceTitle(dialog);
}

function hasReviewAction(): boolean {
  const controls = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], a[href]"));
  return controls.some((control) => isVisible(control) && normalize(control.innerText || control.textContent) === "Review");
}

function getModalSourceKind(dialog: HTMLElement): string {
  const pill = dialog.querySelector<HTMLElement>("[data-cid='Pill']");
  return normalize(pill?.innerText || pill?.textContent);
}

function getModalPreviewText(dialog: HTMLElement): string {
  const highlighted = dialog.querySelector<HTMLElement>(".highlighted");
  const text = normalize(highlighted?.innerText || highlighted?.textContent);
  if (text) {
    return text;
  }

  const media = highlighted?.matches("a[href], iframe[src], img[src], video[src], source[src]")
    ? highlighted
    : highlighted?.querySelector<HTMLElement>("a[href], iframe[src], img[src], video[src], source[src]");
  return normalize(
    media?.getAttribute("aria-label") ||
    media?.getAttribute("title") ||
    media?.getAttribute("src") ||
    media?.getAttribute("href")
  );
}

function getModalIssueCounter(dialog: HTMLElement): { issueIndex: number | null; issueTotal: number | null } {
  const match = normalize(dialog.innerText || dialog.textContent).match(ISSUE_COUNTER_DETAIL_PATTERN);
  if (!match) {
    return {
      issueIndex: null,
      issueTotal: null,
    };
  }

  return {
    issueIndex: Number(match[1]),
    issueTotal: Number(match[2]),
  };
}

function getDetectedIssueCount(issues: IssueSummary[]): number {
  const scorecardTotal = getScorecardIssueTotal();
  if (scorecardTotal !== null) {
    return scorecardTotal;
  }

  const counterCount = getCounterCount();
  if (counterCount !== null) {
    return counterCount;
  }

  return hasFocusedEmptyState() ? 0 : issues.length;
}

function getCounterCount(): number | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(COUNTER_SELECTOR));

  for (const element of elements) {
    if (!isVisible(element) || isInsideWandPanel(element)) {
      continue;
    }

    const count = getCountFromText(normalize(element.innerText || element.textContent));
    if (count !== null) {
      return count;
    }
  }

  return getCountFromText(normalize(document.body.innerText || document.body.textContent));
}

function getScorecardIssueTotal(): number | null {
  const issues = getScorecardIssues();
  if (!issues.length) {
    return getLooseScorecardIssueTotal();
  }

  return issues.reduce((total, issue) => total + issue.count, 0);
}

function getScorecardIssues(): Array<IssueSummary & { count: number }> {
  const table = getScorecardTable();
  if (!table) {
    return [];
  }

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  const issues: Array<IssueSummary & { count: number }> = [];

  for (const row of rows) {
    if (!isVisible(row) || isInsideWandPanel(row)) {
      continue;
    }

    const issue = getScorecardRowIssue(row);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}

function getScorecardTable(): HTMLTableElement | null {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table"));

  return tables.find((table) => {
    if (!isVisible(table) || isInsideWandPanel(table)) {
      return false;
    }

    const headerText = normalize(table.querySelector("thead")?.innerText || table.rows[0]?.innerText);
    return /\bissue type\b/i.test(headerText) && /\bissue count\b/i.test(headerText);
  }) ?? null;
}

function getScorecardRowIssue(row: HTMLTableRowElement): (IssueSummary & { count: number }) | null {
  const cells = Array.from(row.cells)
    .map((cell) => normalize(cell.innerText || cell.textContent))
    .filter(Boolean);

  if (cells.length < 2 || !SCORECARD_CATEGORY_PATTERN.test(cells[0])) {
    return null;
  }

  const count = Number(cells[1]);
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  return {
    label: `${cells[0]} ${count}`,
    source: "scorecard",
    count,
  };
}

function getLooseScorecardIssueTotal(): number | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[role='row']"));
  let total = 0;
  let matchedRows = 0;

  for (const row of rows) {
    if (!isVisible(row) || isInsideWandPanel(row)) {
      continue;
    }

    const count = getScorecardRowCount(row);
    if (count === null) {
      continue;
    }

    total += count;
    matchedRows++;
  }

  return matchedRows >= 3 ? total : null;
}

function getScorecardRowCount(row: HTMLElement): number | null {
  const cells = Array.from(row.querySelectorAll<HTMLElement>("th, td, [role='cell'], [role='columnheader']"))
    .map((cell) => normalize(cell.innerText || cell.textContent))
    .filter(Boolean);

  if (cells.length < 2 || !SCORECARD_CATEGORY_PATTERN.test(cells[0])) {
    return null;
  }

  const count = Number(cells[1]);
  return Number.isFinite(count) ? count : null;
}

function hasFocusedEmptyState(): boolean {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[role='status'], [aria-live], [class*='empty' i], [class*='alert' i]"));

  return elements.some((element) => {
    if (!isVisible(element) || isInsideWandPanel(element)) {
      return false;
    }

    return EMPTY_STATE_PATTERN.test(normalize(element.innerText || element.textContent));
  });
}

function getCountFromText(text: string): number | null {
  const issueCounter = text.match(ISSUE_COUNTER_PATTERN);
  if (issueCounter) {
    return Number(issueCounter[1]);
  }

  const paginationCounter = text.match(PAGINATION_COUNTER_PATTERN);
  if (paginationCounter) {
    return Number(paginationCounter[1]);
  }

  const totalIssues = text.match(TOTAL_ISSUES_PATTERN);
  if (totalIssues) {
    return Number(totalIssues[1]);
  }

  return null;
}

function isIssueRow(label: string): boolean {
  if (EMPTY_STATE_PATTERN.test(label)) {
    return false;
  }

  if (/\ban error occurred while checking this file\b/i.test(label)) {
    return true;
  }

  return ISSUE_TEXT_PATTERN.test(label) && !isGenericReviewRow(label);
}

function isGenericReviewRow(label: string): boolean {
  return /\breview\b/i.test(label) && !/\b(error|issue|warning)\b/i.test(label);
}

function getIssueLabel(element: HTMLElement): string {
  return normalize(element.innerText || element.textContent).slice(0, 220);
}

function getElementSource(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  const className = getClassName(element);

  return [tag, role ? `[role="${role}"]` : "", className ? `.${className.split(" ").join(".")}` : ""].join("");
}

function getClassName(element: HTMLElement): string {
  if (typeof element.className === "string") {
    return normalize(element.className);
  }

  return normalize(element.getAttribute("class"));
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function isInsideWandPanel(element: HTMLElement): boolean {
  return Boolean(element.closest("#wand-panel"));
}

function getSnapshotSignature(snapshot: PageSnapshot): string {
  return JSON.stringify({
    pageKind: snapshot.pageKind,
    activeIssueType: snapshot.activeIssueType,
    issueCount: snapshot.issueCount,
    issues: snapshot.issues.map((issue) => issue.label),
    remediation: snapshot.remediation,
    udoitView: snapshot.udoitView,
    url: snapshot.url,
  });
}
