export const DIAGNOSTIC_LOG_STORAGE_KEY = "wandDiagnosticLog";
const MAX_DIAGNOSTIC_EVENTS = 25;

export type DiagnosticEvent = {
  code: string;
  message: string;
  issueType?: string;
  sourceTitle?: string;
  url: string;
  appVersion: string;
  observedAt: number;
  details?: Record<string, unknown>;
};

export async function recordDiagnosticEvent(event: DiagnosticEvent): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(DIAGNOSTIC_LOG_STORAGE_KEY);
    const previous = Array.isArray(stored[DIAGNOSTIC_LOG_STORAGE_KEY])
      ? stored[DIAGNOSTIC_LOG_STORAGE_KEY] as DiagnosticEvent[]
      : [];
    await chrome.storage.local.set({
      [DIAGNOSTIC_LOG_STORAGE_KEY]: [event, ...previous].slice(0, MAX_DIAGNOSTIC_EVENTS),
    });
  } catch (error) {
    console.warn("[wand] Could not record diagnostic event.", error);
  }
}

export function createDiagnosticEvent(
  code: string,
  message: string,
  context?: { issueType?: string; sourceTitle?: string },
  details: Record<string, unknown> = {}
): DiagnosticEvent {
  return {
    code,
    message,
    issueType: context?.issueType,
    sourceTitle: context?.sourceTitle,
    url: window.location.href,
    appVersion: __APP_VERSION__,
    observedAt: Date.now(),
    details,
  };
}
