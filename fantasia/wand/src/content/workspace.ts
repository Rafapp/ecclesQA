import { REMEDIATION_WORKSPACE_MESSAGE, type OpenWorkspaceMessage } from "../shared/remediation";

const WORKSPACE_ID = "wand-workspace";
const FRAME_ID = "wand-workspace-frame";
const CLOSE_ID = "wand-workspace-close";
const RESIZER_ID = "wand-workspace-resizer";
const MIN_LEFT_PCT = 20;
const MAX_LEFT_PCT = 80;

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
  workspace.replaceChildren(createResizer(workspace), createHeader(), createFrame());
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

function createResizer(workspace: HTMLElement): HTMLElement {
  const resizer = document.createElement("div");
  resizer.id = RESIZER_ID;
  resizer.setAttribute("aria-hidden", "true");

  resizer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);

    const onMove = (moveEvent: PointerEvent): void => {
      const pct = Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, (moveEvent.clientX / window.innerWidth) * 100));
      workspace.style.left = `${pct}vw`;
      document.documentElement.style.setProperty("--wand-split", `${pct}vw`);
    };

    const onUp = (): void => {
      resizer.removeEventListener("pointermove", onMove);
      resizer.removeEventListener("pointerup", onUp);
    };

    resizer.addEventListener("pointermove", onMove);
    resizer.addEventListener("pointerup", onUp);
  });

  return resizer;
}

function createFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Canvas remediation target";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  return frame;
}
