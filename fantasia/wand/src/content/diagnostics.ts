import { createDiagnosticEvent, recordDiagnosticEvent } from "../shared/diagnostics";

export function reportError(
  code: string,
  message: string,
  context?: { issueType?: string; sourceTitle?: string },
  details: Record<string, unknown> = {}
): void {
  const event = createDiagnosticEvent(code, message, context, details);
  console.error("[wand] Diagnostic event", event);
  void recordDiagnosticEvent(event);
}
