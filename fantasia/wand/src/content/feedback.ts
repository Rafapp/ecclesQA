import { DIAGNOSTIC_LOG_STORAGE_KEY, type DiagnosticEvent } from "../shared/diagnostics";

const FEEDBACK_DRAFTS_STORAGE_KEY = "wandFeedbackDrafts";
const MAX_FEEDBACK_DRAFTS = 50;

export type FeedbackKind = "bug" | "suggestion";

type FeedbackDraft = {
  id: string;
  kind: FeedbackKind;
  summary: string;
  details: string;
  pageUrl?: string;
  issueType?: string;
  sourceTitle?: string;
  appVersion: string;
  createdAt: number;
  diagnostics: DiagnosticEvent[];
};

export function createFeedbackDraft(input: FeedbackDraft): FeedbackDraft {
  return {
    ...input,
    summary: input.summary.trim(),
    details: input.details.trim(),
    diagnostics: input.diagnostics.slice(0, 5),
  };
}

export async function getRecentDiagnostics(includeDiagnostics: boolean): Promise<DiagnosticEvent[]> {
  if (!includeDiagnostics) {
    return [];
  }
  const stored = await chrome.storage.local.get(DIAGNOSTIC_LOG_STORAGE_KEY);
  return Array.isArray(stored[DIAGNOSTIC_LOG_STORAGE_KEY])
    ? (stored[DIAGNOSTIC_LOG_STORAGE_KEY] as DiagnosticEvent[]).slice(0, 5)
    : [];
}

export async function saveFeedbackDraft(draft: FeedbackDraft): Promise<void> {
  const stored = await chrome.storage.local.get(FEEDBACK_DRAFTS_STORAGE_KEY);
  const previous = Array.isArray(stored[FEEDBACK_DRAFTS_STORAGE_KEY])
    ? stored[FEEDBACK_DRAFTS_STORAGE_KEY] as FeedbackDraft[]
    : [];
  await chrome.storage.local.set({
    [FEEDBACK_DRAFTS_STORAGE_KEY]: [draft, ...previous].slice(0, MAX_FEEDBACK_DRAFTS),
  });
}

export function formatFeedbackDraft(draft: FeedbackDraft): string {
  const lines = [
    draft.kind === "bug" ? "Wand bug report" : "Wand suggestion",
    `Report ID: ${draft.id}`,
    `Created: ${new Date(draft.createdAt).toISOString()}`,
    `Wand version: ${draft.appVersion}`,
    `Summary: ${draft.summary}`,
    "",
    draft.details,
  ];
  if (draft.issueType) lines.push("", `UDOIT issue: ${draft.issueType}`);
  if (draft.sourceTitle) lines.push(`Canvas source: ${draft.sourceTitle}`);
  if (draft.pageUrl) lines.push(`Page: ${draft.pageUrl}`);
  if (draft.diagnostics.length) lines.push("", "Recent diagnostics:", JSON.stringify(draft.diagnostics, null, 2));
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

export function createFeedbackId(now = Date.now()): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  return `wand-${now.toString(36)}-${random}`;
}
