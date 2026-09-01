import type { RemediationContext } from "./types";

export const REMEDIATION_STORAGE_KEY = "wandPendingRemediation";
export const ADVANCE_PENDING_STORAGE_KEY = "wandAdvancePending";
export const REMEDIATION_WORKSPACE_MESSAGE = "wand:open-remediation-workspace";
export const PREPARE_WORKSPACE_MESSAGE = "wand:prepare-remediation-workspace";
export const OPEN_MEDIA_PLATFORM_MESSAGE = "wand:open-media-platform";

export type RemediationWorkflow = "canvas" | "linkText" | "imageAlt";
export type WorkspaceAction = "apply-color-cue" | "open-caption-source" | "refresh-caption-status";

export type WorkspaceActionDefinition = {
  action: WorkspaceAction;
  label: string;
};

export type RemediationDefinition = {
  issueType: string;
  aliases?: string[];
  workflow: RemediationWorkflow;
  actionLabel: string;
  busyLabel: string;
  workspaceGuidance?: string;
  workspaceActions?: WorkspaceActionDefinition[];
  requiresPreview?: boolean;
};

export const REMEDIATION_DEFINITIONS: RemediationDefinition[] = [
  {
    issueType: "Styles might be used instead of semantic markup for structure",
    workflow: "canvas",
    actionLabel: "Remediate styled headings",
    busyLabel: "Opening Canvas remediation…",
    workspaceGuidance: "Apply the correct semantic heading level in Canvas, then save your change.",
  },
  {
    issueType: "Link has nondescript text",
    workflow: "linkText",
    actionLabel: "Improve link text",
    busyLabel: "Improving link text…",
  },
  {
    issueType: "Potential use of color alone to communicate information",
    workflow: "canvas",
    actionLabel: "Identify color-only content",
    busyLabel: "Opening color-use remediation…",
    workspaceGuidance: "Add a non-color cue such as bold text, an icon, or descriptive wording, then save your change.",
    workspaceActions: [
      {
        action: "apply-color-cue",
        label: "Add bold cue to selection",
      },
    ],
  },
  {
    issueType: "Alternative text uses filename rather than a descriptive label",
    workflow: "imageAlt",
    actionLabel: "Improve alternative text",
    busyLabel: "Improving alternative text…",
    requiresPreview: false,
  },
  {
    issueType: "Video captions appear to be automatically generated and may contain errors",
    aliases: ["Closed Captions Were Auto-Generated"],
    workflow: "canvas",
    actionLabel: "Review video captions",
    busyLabel: "Opening caption review…",
    workspaceGuidance: "Review the automatic captions for accuracy, correct them in the video platform, then mark this issue resolved.",
    workspaceActions: [
      {
        action: "open-caption-source",
        label: "Open video platform",
      },
      {
        action: "refresh-caption-status",
        label: "Check captions again",
      },
    ],
    requiresPreview: false,
  },
];

export const SUPPORTED_REMEDIATIONS = REMEDIATION_DEFINITIONS.map(({ issueType }) => issueType);

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

export type OpenMediaPlatformMessage = {
  type: typeof OPEN_MEDIA_PLATFORM_MESSAGE;
  url: string;
};

export function isSupportedRemediation(issueType: string): boolean {
  return Boolean(getRemediationDefinition(issueType));
}

export function getRemediationDefinition(issueType: string): RemediationDefinition | undefined {
  const normalizedIssueType = issueType.trim().toLowerCase();
  return REMEDIATION_DEFINITIONS.find((definition) =>
    [definition.issueType, ...(definition.aliases ?? [])]
      .some((candidate) => candidate.toLowerCase() === normalizedIssueType)
  );
}
