const PREPARE_WORKSPACE_MESSAGE = "wand:prepare-remediation-workspace";
const REMEDIATION_WORKSPACE_MESSAGE = "wand:open-remediation-workspace";
const WORKSPACE_TAB_MAX_AGE_MS = 15000;

let workspaceSource: {
  tabId: number;
  createdAt: number;
  courseScope: string;
} | null = null;

type RuntimeMessage = {
  type?: string;
};

type OpenWorkspaceMessage = {
  type: typeof REMEDIATION_WORKSPACE_MESSAGE;
  url: string;
};

export function initializeWorkspaceRouting(): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender) => {
    if (message.type !== PREPARE_WORKSPACE_MESSAGE || typeof sender.tab?.id !== "number") {
      return false;
    }

    const courseScope = getCanvasCourseScope(sender.tab.url);
    if (!courseScope) {
      return false;
    }

    workspaceSource = {
      tabId: sender.tab.id,
      createdAt: Date.now(),
      courseScope,
    };

    return false;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!workspaceSource || !changeInfo.url || !isWorkspaceTarget(tab, changeInfo.url)) {
      return;
    }

    const message: OpenWorkspaceMessage = {
      type: REMEDIATION_WORKSPACE_MESSAGE,
      url: changeInfo.url,
    };

    void chrome.tabs.sendMessage(workspaceSource.tabId, message);
    void chrome.tabs.remove(tabId);
    workspaceSource = null;
  });
}

function isWorkspaceTarget(tab: chrome.tabs.Tab, url: string): boolean {
  if (Date.now() - workspaceSource!.createdAt > WORKSPACE_TAB_MAX_AGE_MS) {
    workspaceSource = null;
    return false;
  }

  if (!url.startsWith(workspaceSource!.courseScope)) {
    return false;
  }

  return tab.openerTabId === undefined || tab.openerTabId === workspaceSource!.tabId;
}

function getCanvasCourseScope(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const coursePath = parsed.pathname.match(/^\/courses\/\d+/)?.[0];
    if (!parsed.hostname.endsWith(".instructure.com") || !coursePath) {
      return null;
    }

    return `${parsed.origin}${coursePath}/`;
  } catch {
    return null;
  }
}
