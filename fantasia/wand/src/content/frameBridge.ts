import type { UdoitAction, WorkspaceAction } from "../shared/remediation";
import type { PageSnapshot } from "../shared/types";

const SNAPSHOT_MESSAGE = "wand:page-snapshot";
const COMMAND_MESSAGE = "wand:frame-command";
const SAVE_MESSAGE = "wand:canvas-saved";
const WORKSPACE_URL_MESSAGE = "wand:workspace-url";
const REMEDIATION_ERROR_MESSAGE = "wand:remediation-error";
const ACTION_STATE_MESSAGE = "wand:action-state";
const ACTION_SUCCESS_MESSAGE = "wand:action-success";

export type FrameCommand = {
  type: "start-remediation" | "resolve-remediation" | "advance-remediation" | "workspace-opened" | WorkspaceAction | UdoitAction;
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

type RemediationErrorMessage = {
  type?: string;
  message?: string;
};

type ActionStateMessage = {
  type?: string;
  active?: boolean;
  label?: string;
};

type ActionSuccessMessage = {
  type?: string;
  message?: string;
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

export function postRemediationErrorToTop(message: string): void {
  window.parent.postMessage({
    type: REMEDIATION_ERROR_MESSAGE,
    message,
  }, "*");
}

export function listenForRemediationErrors(onError: (message: string) => void): void {
  window.addEventListener("message", (event) => {
    if (!isRemediationErrorMessage(event.data)) {
      return;
    }

    onError(event.data.message);
  });
}

export function postActionStateToTop(active: boolean, label = ""): void {
  window.parent.postMessage({
    type: ACTION_STATE_MESSAGE,
    active,
    label,
  }, "*");
}

export function listenForActionState(onStateChange: (active: boolean, label: string) => void): void {
  window.addEventListener("message", (event) => {
    if (!isActionStateMessage(event.data)) {
      return;
    }

    onStateChange(event.data.active, event.data.label);
  });
}

export function postActionSuccessToTop(message: string): void {
  window.parent.postMessage({
    type: ACTION_SUCCESS_MESSAGE,
    message,
  }, "*");
}

export function listenForActionSuccess(onSuccess: (message: string) => void): void {
  window.addEventListener("message", (event) => {
    if (!isActionSuccessMessage(event.data)) {
      return;
    }

    onSuccess(event.data.message);
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
  return message.type === COMMAND_MESSAGE && (
    message.command?.type === "start-remediation" ||
    message.command?.type === "resolve-remediation" ||
    message.command?.type === "advance-remediation" ||
    message.command?.type === "workspace-opened" ||
    message.command?.type === "apply-color-cue" ||
    message.command?.type === "open-caption-source" ||
    message.command?.type === "refresh-caption-status" ||
    message.command?.type === "expand-preview" ||
    message.command?.type === "save-and-next"
  );
}

function isActionSuccessMessage(value: unknown): value is Required<ActionSuccessMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as ActionSuccessMessage;
  return message.type === ACTION_SUCCESS_MESSAGE &&
    typeof message.message === "string" &&
    message.message.length > 0 &&
    message.message.length <= 240;
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

function isRemediationErrorMessage(value: unknown): value is Required<RemediationErrorMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as RemediationErrorMessage;
  return message.type === REMEDIATION_ERROR_MESSAGE &&
    typeof message.message === "string" &&
    message.message.length > 0 &&
    message.message.length <= 240;
}

function isActionStateMessage(value: unknown): value is Required<ActionStateMessage> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as ActionStateMessage;
  return message.type === ACTION_STATE_MESSAGE &&
    typeof message.active === "boolean" &&
    typeof message.label === "string" &&
    message.label.length <= 120;
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
