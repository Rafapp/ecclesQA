export type WandConfig = {
  retryCount: number;
  timeouts: {
    defaultMs: number;
    pollIntervalMs: number;
  };
  features: {
    panel: boolean;
    debugLogging: boolean;
  };
};

export type PageKind = "canvas" | "udoit" | "unknown";
export type UdoitView = "scorecard" | "issueList" | "fixModal" | "unknown";

export type IssueSummary = {
  label: string;
  source: string;
};

export type RemediationContext = {
  issueType: string;
  sourceTitle: string;
  sourceKind: string;
  issueIndex: number | null;
  issueTotal: number | null;
  previewText: string;
};

export type PageSnapshot = {
  pageKind: PageKind;
  udoitView?: UdoitView;
  issueCount: number;
  issues: IssueSummary[];
  remediation?: RemediationContext;
  url: string;
  observedAt: number;
};
