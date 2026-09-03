import type { RemediationContext } from "./types";

export const REMEDIATION_STORAGE_KEY = "wandPendingRemediation";
export const ADVANCE_PENDING_STORAGE_KEY = "wandAdvancePending";
export const ADVANCE_PENDING_MAX_AGE_MS = 60000;
export const REMEDIATION_WORKSPACE_MESSAGE = "wand:open-remediation-workspace";
export const PREPARE_WORKSPACE_MESSAGE = "wand:prepare-remediation-workspace";
export const OPEN_MEDIA_PLATFORM_MESSAGE = "wand:open-media-platform";

export type RemediationWorkflow = "canvas" | "linkText" | "imageAlt";
export type WorkspaceAction = "apply-color-cue" | "open-caption-source" | "refresh-caption-status";
export type UdoitAction = "expand-preview" | "save-and-next";

export type WorkspaceActionDefinition = {
  action: WorkspaceAction;
  label: string;
};

export type UdoitActionDefinition = {
  action: UdoitAction;
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
  udoitActions?: UdoitActionDefinition[];
  requiresPreview?: boolean;
};

export const REMEDIATION_DEFINITIONS: RemediationDefinition[] = [
  {
    issueType: "Styles might be used instead of semantic markup for structure",
    workflow: "canvas",
    actionLabel: "Remediate styled headings",
    busyLabel: "Opening Canvas remediation...",
    workspaceGuidance: "Apply the correct semantic heading level in Canvas, then save your change.",
  },
  {
    issueType: "Link has nondescript text",
    aliases: ["Link Text Should be Descriptive"],
    workflow: "linkText",
    actionLabel: "Improve link text",
    busyLabel: "Improving link text...",
    udoitActions: [
      {
        action: "save-and-next",
        label: "Save and go to next",
      },
    ],
  },
  {
    issueType: "Potential use of color alone to communicate information",
    workflow: "canvas",
    actionLabel: "Identify color-only content",
    busyLabel: "Opening color-use remediation...",
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
    aliases: ["Alternative text should not be the image file name"],
    workflow: "imageAlt",
    actionLabel: "Improve alternative text",
    busyLabel: "Improving alternative text...",
    udoitActions: [
      {
        action: "save-and-next",
        label: "Save and go to next",
      },
    ],
    requiresPreview: false,
  },
  {
    issueType: "Alternative text appears to be a generic placeholder",
    workflow: "canvas",
    actionLabel: "Review placeholder alternative text",
    busyLabel: "Opening alternative-text remediation...",
    workspaceGuidance: "Replace placeholder alternative text such as image or photo with a concise description, or mark the image decorative when appropriate, then save.",
  },
  {
    issueType: "Alternative text is too lengthy for optimal screen reader experience",
    workflow: "canvas",
    actionLabel: "Shorten alternative text",
    busyLabel: "Opening alternative-text remediation...",
    workspaceGuidance: "Shorten the alternative text to its essential meaning. Move complex detail into nearby page text when needed, then save.",
  },
  {
    issueType: "Decorative image does not have an empty alternative text",
    workflow: "canvas",
    actionLabel: "Review decorative image",
    busyLabel: "Opening image remediation...",
    workspaceGuidance: "Confirm the image is decorative, then mark it decorative or give it empty alternative text. If it conveys meaning, provide descriptive alternative text instead.",
  },
  {
    issueType: "Image does not include an alt\" attribute\"",
    aliases: ["Image does not include an alt attribute"],
    workflow: "canvas",
    actionLabel: "Add image alternative text",
    busyLabel: "Opening image remediation...",
    workspaceGuidance: "Add concise alternative text that communicates the image's purpose, or mark the image decorative when it conveys no information, then save.",
  },
  {
    issueType: "Image long description is identical to alternative text",
    workflow: "canvas",
    actionLabel: "Review image descriptions",
    busyLabel: "Opening image remediation...",
    workspaceGuidance: "Keep alternative text concise and make any long description provide additional detail. Remove the duplicate long description when it adds no value.",
  },
  {
    issueType: "Linked image does not have a descriptive alternative text",
    workflow: "canvas",
    actionLabel: "Describe linked image",
    busyLabel: "Opening linked-image remediation...",
    workspaceGuidance: "Give the linked image alternative text that describes the link's destination or action rather than only the image appearance, then save.",
  },
  {
    issueType: "Video captions appear to be automatically generated and may contain errors",
    aliases: ["Closed Captions Were Auto-Generated"],
    workflow: "canvas",
    actionLabel: "Review video captions",
    busyLabel: "Opening caption review...",
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
  {
    issueType: "Heading levels should not be skipped",
    aliases: ["Heading levels have been skipped", "Page contains skipped headings"],
    workflow: "canvas",
    actionLabel: "Review heading order",
    busyLabel: "Opening heading remediation...",
    workspaceGuidance: "Adjust the selected heading level in Canvas so the page outline does not skip levels, then save.",
  },
  {
    issueType: "Headings should contain text",
    aliases: ["Headings Should Contant Text", "One or more heading elements do not contain text"],
    workflow: "canvas",
    actionLabel: "Review empty heading",
    busyLabel: "Opening heading remediation...",
    workspaceGuidance: "Add meaningful heading text or remove the empty heading element in Canvas, then save.",
  },
  {
    issueType: "No headings found",
    aliases: ["No heading structure found", "Headings may be missing"],
    workflow: "canvas",
    actionLabel: "Review page headings",
    busyLabel: "Opening heading review...",
    workspaceGuidance: "Add a meaningful heading structure in Canvas, then save. Wand will not choose heading text for you.",
    requiresPreview: false,
  },
  {
    issueType: "Link text should not be empty",
    aliases: ["Links should contain text", "Link text is empty", "Links must have discernible text", "Link does not contain text"],
    workflow: "canvas",
    actionLabel: "Review empty link",
    busyLabel: "Opening link remediation...",
    workspaceGuidance: "Add descriptive visible link text in Canvas, then save.",
    requiresPreview: false,
  },
  {
    issueType: "No table headers found",
    aliases: ["Table does not include header rows or columns"],
    workflow: "canvas",
    actionLabel: "Review table headers",
    busyLabel: "Opening table remediation...",
    workspaceGuidance: "Choose the appropriate header row, header column, or both after reviewing the table structure, then save.",
    udoitActions: [
      {
        action: "expand-preview",
        label: "Open preview",
      },
      {
        action: "save-and-next",
        label: "Save and go to next",
      },
    ],
    requiresPreview: false,
  },
  {
    issueType: "No row or column scopes declarations found in table headers",
    aliases: ["No row or column scope declarations found in table headers", "No row or column scopes declarations found in the header of your table", "Table headers are missing row or column scope attributes"],
    workflow: "canvas",
    actionLabel: "Review table scopes",
    busyLabel: "Opening table remediation...",
    workspaceGuidance: "Set the correct table header scope after reviewing the table structure, then save.",
    udoitActions: [
      {
        action: "expand-preview",
        label: "Open preview",
      },
      {
        action: "save-and-next",
        label: "Save and go to next",
      },
    ],
    requiresPreview: false,
  },
  {
    issueType: "Insufficient text color contrast with the background",
    aliases: ["Insufficient color contrast"],
    workflow: "canvas",
    actionLabel: "Review color contrast",
    busyLabel: "Opening contrast remediation...",
    workspaceGuidance: "Adjust text or background color to a compliant contrast value using approved brand colors, then save.",
  },
  {
    issueType: "No closed captions found",
    aliases: ["Closed captions are missing", "Video is missing captions", "Embedded video is missing captions"],
    workflow: "canvas",
    actionLabel: "Review missing captions",
    busyLabel: "Opening caption remediation...",
    workspaceGuidance: "Add or verify captions in the video platform, then check captions again or mark the issue resolved.",
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
  {
    issueType: "Caption status could not be verified for this video",
    workflow: "canvas",
    actionLabel: "Verify video captions",
    busyLabel: "Opening caption review...",
    workspaceGuidance: "Open the video platform and verify that accurate captions exist. Return to UDOIT and check the caption status again when finished.",
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
  {
    issueType: "Links to multimedia require transcripts",
    workflow: "canvas",
    actionLabel: "Review multimedia transcript",
    busyLabel: "Opening transcript review...",
    workspaceGuidance: "Provide a transcript for spoken or meaningful audio in the linked multimedia and place a clearly labeled transcript link near the media.",
  },
  {
    issueType: "Links to sound files need transcripts",
    workflow: "canvas",
    actionLabel: "Review audio transcript",
    busyLabel: "Opening transcript review...",
    workspaceGuidance: "Provide an accurate transcript for the linked audio and add a clearly labeled transcript link adjacent to the audio link.",
  },
  {
    issueType: "Linked or embedded external content may not meet accessibility standards",
    workflow: "canvas",
    actionLabel: "Review external content",
    busyLabel: "Opening external-content review...",
    workspaceGuidance: "Review the linked or embedded resource for keyboard access, meaningful labels, captions or transcripts, and other relevant accessibility requirements. Replace it or provide an accessible alternative when the external resource cannot be corrected.",
    requiresPreview: false,
  },
  {
    issueType: "Content may exceed recommended length for readability (3000+ words)",
    workflow: "canvas",
    actionLabel: "Review content length",
    busyLabel: "Opening readability review...",
    workspaceGuidance: "Review the page structure and consider dividing long content into meaningful sections or pages. Preserve context and navigation when splitting it.",
    requiresPreview: false,
  },
  {
    issueType: "Deprecated font tag in use",
    workflow: "canvas",
    actionLabel: "Replace deprecated font styling",
    busyLabel: "Opening formatting remediation...",
    workspaceGuidance: "Remove the deprecated font element and apply equivalent presentation with Canvas formatting while preserving semantic structure, then save.",
  },
  {
    issueType: "Document reading direction not found",
    workflow: "canvas",
    actionLabel: "Review document direction",
    busyLabel: "Opening direction review...",
    workspaceGuidance: "Verify the page's reading direction. In the HTML editor, set the appropriate left-to-right or right-to-left direction when the content requires it.",
    requiresPreview: false,
  },
  {
    issueType: "Lists should be formatted as lists",
    aliases: ["List items should be formatted using list markup"],
    workflow: "canvas",
    actionLabel: "Review list formatting",
    busyLabel: "Opening list remediation...",
    workspaceGuidance: "Convert the selected text to a real ordered or unordered list in Canvas, then save.",
  },
  {
    issueType: "Table used for layout",
    aliases: ["Tables should not be used for layout", "Avoid using tables for layout"],
    workflow: "canvas",
    actionLabel: "Review layout table",
    busyLabel: "Opening table review...",
    workspaceGuidance: "Review whether the table is layout-only. Replace it with regular Canvas content when appropriate, then save.",
    requiresPreview: false,
  },
  {
    issueType: "Styles might be used for tabular data where semantic markup may be more appropriate",
    workflow: "canvas",
    actionLabel: "Review tabular structure",
    busyLabel: "Opening table review...",
    workspaceGuidance: "Determine whether the selected content represents data relationships. Use a semantic table with appropriate headers when it does; otherwise use regular structured content.",
  },
  {
    issueType: "Table without content detected",
    workflow: "canvas",
    actionLabel: "Review empty table",
    busyLabel: "Opening table review...",
    workspaceGuidance: "Remove the empty table when it serves no purpose. If content is missing, add meaningful data and appropriate headers before saving.",
  },
];

export const SUPPORTED_REMEDIATIONS = REMEDIATION_DEFINITIONS.map(({ issueType }) => issueType);

export function isAdvancePendingFresh(value: unknown, now = Date.now()): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value <= now &&
    now - value <= ADVANCE_PENDING_MAX_AGE_MS;
}

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
