import { REMEDIATION_WORKSPACE_MESSAGE, type OpenWorkspaceMessage } from "../shared/remediation";

const WORKSPACE_ID = "wand-workspace";
const FRAME_ID = "wand-workspace-frame";
const CLOSE_ID = "wand-workspace-close";

export function initializeWorkspace(): void {
  chrome.runtime.onMessage.addListener((message: OpenWorkspaceMessage) => {
    if (message.type !== REMEDIATION_WORKSPACE_MESSAGE) {
      return false;
    }

    openWorkspace(message.url);
    return false;
  });
}

export function closeWorkspace(): void {
  document.documentElement.classList.remove("wand-workspace-active");
  dispatchWorkspaceState(false);
  document.getElementById(WORKSPACE_ID)?.remove();
}

export function openWorkspace(url: string): void {
  const workspace = getOrCreateWorkspace();
  const frame = workspace.querySelector<HTMLIFrameElement>(`#${FRAME_ID}`);
  if (!frame) {
    return;
  }

  document.documentElement.classList.add("wand-workspace-active");
  dispatchWorkspaceState(true);
  frame.src = url;
  window.setTimeout(() => centerUdoitModal(), 350);
}

function getOrCreateWorkspace(): HTMLElement {
  const existingWorkspace = document.getElementById(WORKSPACE_ID);
  if (existingWorkspace instanceof HTMLElement) {
    return existingWorkspace;
  }

  const workspace = document.createElement("section");
  workspace.id = WORKSPACE_ID;
  workspace.setAttribute("aria-label", "Wand remediation workspace");
  workspace.replaceChildren(createHeader(), createFrame());
  document.documentElement.append(workspace);
  return workspace;
}

function createHeader(): HTMLElement {
  const header = document.createElement("div");
  header.className = "wand-workspace__header";

  const title = document.createElement("div");
  title.className = "wand-workspace__title";
  title.textContent = "Canvas remediation";

  const close = document.createElement("button");
  close.id = CLOSE_ID;
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", closeWorkspace);

  header.replaceChildren(title, close);
  return header;
}

function dispatchWorkspaceState(active: boolean): void {
  window.dispatchEvent(new CustomEvent("wand:workspace-state", {
    detail: {
      active,
    },
  }));
}

function centerUdoitModal(): void {
  const dialog = document.querySelector<HTMLElement>("[role='dialog']");
  dialog?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
}

function createFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Canvas remediation target";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  return frame;
}
