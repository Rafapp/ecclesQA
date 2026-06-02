import type { PageSnapshot } from "../shared/types";

const SNAPSHOT_MESSAGE = "wand:page-snapshot";
const COMMAND_MESSAGE = "wand:frame-command";
const SAVE_MESSAGE = "wand:canvas-saved";
const WORKSPACE_URL_MESSAGE = "wand:workspace-url";

export type FrameCommand = {
  type: "start-remediation" | "advance-remediation";
};

export type CanvasSaveMessage = {
  type: typeof SAVE_MESSAGE;
};

export type WorkspaceUrlMessage = {
  type: typeof WORKSPACE_URL_MESSAGE;
  url: string;
};

type SnapshotMessage = {
  type?: string;
  snapshot?: PageSnapshot;
};

type CommandMessage = {
  type?: string;
  command?: FrameCommand;
};

type WorkspaceMessage = {
  type?: string;
  url?: string;
};

export function isTopFrame(): boolean {
  return window.top === window;
}

export function postSnapshotToTop(snapshot: PageSnapshot): void {
  window.parent.postMessage({
    type: SNAPSHOT_MESSAGE,
    snapshot,
  }, "*");
}

export function listenForFrameSnapshots(onSnapshot: (snapshot: PageSnapshot) => void): void {
  window.addEventListener("message", (event) => {
    if (event.source === window || !isSnapshotMessage(event.data)) {
      return;
    }

    onSnapshot(event.data.snapshot);
  });
}

export function postCommandToFrames(command: FrameCommand): void {
  for (let index = 0; index < window.frames.length; index++) {
    window.frames[index]?.postMessage({
      type: COMMAND_MESSAGE,
      command,
    }, "*");
  }
}

export function postCanvasSavedToTop(): void {
  window.parent.postMessage({
    type: SAVE_MESSAGE,
  }, "*");
}

export function listenForCanvasSaved(onSave: () => void): void {
  window.addEventListener("message", (event) => {
    if (!isCanvasSaveMessage(event.data)) {
      return;
    }

    onSave();
  });
}

export function postWorkspaceUrlToTop(url: string): void {
  window.parent.postMessage({
    type: WORKSPACE_URL_MESSAGE,
    url,
  }, "*");
}

export function listenForWorkspaceUrls(onWorkspaceUrl: (url: string) => void): void {
  window.addEventListener("message", (event) => {
    if (!isWorkspaceUrlMessage(event.data)) {
      return;
    }

    onWorkspaceUrl(event.data.url);
  });
}

export function listenForFrameCommands(onCommand: (command: FrameCommand) => void): void {
  window.addEventListener("message", (event) => {
    if (!isCommandMessage(event.data)) {
      return;
    }

    onCommand(event.data.command);
  });
}

function isSnapshotMessage(value: unknown): value is Required<SnapshotMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as SnapshotMessage;
  return message.type === SNAPSHOT_MESSAGE && isPageSnapshot(message.snapshot);
}

function isCommandMessage(value: unknown): value is Required<CommandMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as CommandMessage;
  return message.type === COMMAND_MESSAGE && (message.command?.type === "start-remediation" || message.command?.type === "advance-remediation");
}

function isCanvasSaveMessage(value: unknown): value is Required<CanvasSaveMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as CanvasSaveMessage;
  return message.type === SAVE_MESSAGE;
}

function isWorkspaceUrlMessage(value: unknown): value is Required<WorkspaceUrlMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as WorkspaceMessage;
  return message.type === WORKSPACE_URL_MESSAGE && typeof message.url === "string" && /^https:\/\/[^/]+\.instructure\.com\//.test(message.url);
}

function isPageSnapshot(value: unknown): value is PageSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as PageSnapshot;
  return typeof snapshot.pageKind === "string" &&
    typeof snapshot.issueCount === "number" &&
    Array.isArray(snapshot.issues) &&
    typeof snapshot.url === "string" &&
    typeof snapshot.observedAt === "number";
}
