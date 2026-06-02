import type { RemediationContext } from "./types";

export const REMEDIATION_STORAGE_KEY = "wandPendingRemediation";
export const ADVANCE_PENDING_STORAGE_KEY = "wandAdvancePending";
export const REMEDIATION_WORKSPACE_MESSAGE = "wand:open-remediation-workspace";
export const PREPARE_WORKSPACE_MESSAGE = "wand:prepare-remediation-workspace";
export const SUPPORTED_REMEDIATIONS = [
  "Styles might be used instead of semantic markup for structure",
  "Link has nondescript text",
  "Potential use of color alone to communicate information",
  "Alternative text uses filename rather than a descriptive label",
  "Video captions appear to be automatically generated and may contain errors",
];

export type PendingRemediation = RemediationContext & {
  createdAt: number;
};

export type PrepareWorkspaceMessage = {
  type: typeof PREPARE_WORKSPACE_MESSAGE;
};

export type OpenWorkspaceMessage = {
  type: typeof REMEDIATION_WORKSPACE_MESSAGE;
  url: string;
};

export function isSupportedRemediation(issueType: string): boolean {
  return SUPPORTED_REMEDIATIONS.some((supportedIssue) => supportedIssue.toLowerCase() === issueType.toLowerCase());
}
