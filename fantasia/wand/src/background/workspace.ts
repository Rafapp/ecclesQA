const PREPARE_WORKSPACE_MESSAGE = "wand:prepare-remediation-workspace";
const REMEDIATION_WORKSPACE_MESSAGE = "wand:open-remediation-workspace";
const WORKSPACE_TAB_MAX_AGE_MS = 15000;

let workspaceSource: {
  tabId: number;
  createdAt: number;
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

    workspaceSource = {
      tabId: sender.tab.id,
      createdAt: Date.now(),
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

  if (tab.openerTabId !== workspaceSource!.tabId) {
    return false;
  }

  return /^https:\/\/[^/]+\.instructure\.com\//.test(url);
}
