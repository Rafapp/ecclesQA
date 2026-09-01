import panelStyles from "../content.css?raw";
import { getRemediationDefinition, isSupportedRemediation, SUPPORTED_REMEDIATIONS, type WorkspaceAction } from "../shared/remediation";
import type { PageSnapshot } from "../shared/types";

const PANEL_ID = "wand-panel";
const STYLE_ID = "wand-panel-style";
const ACTION_ID = "wand-remediate-action";
const RESOLVE_ID = "wand-resolve-action";
const TOGGLE_ID = "wand-panel-toggle";
const PANEL_TITLE = "Wand";
const VERSION_LABEL = `Version ${__APP_VERSION__}`;
const ICON_URL = chrome.runtime.getURL("icons/48.png");
const COLLAPSED_CLASS = "wand-panel--collapsed";
const TOAST_ID = "wand-panel-toast";
const WORKSPACE_ACTION_ATTRIBUTE = "data-wand-workspace-action";

let workspaceActive = false;
let lastSnapshot: PageSnapshot | null = null;
let collapsed = false;
let busy = false;
let busyLabel = "Working…";

export function createPanel(
  onRemediate?: () => void,
  onResolve?: () => void,
  onWorkspaceAction?: (action: WorkspaceAction) => void
): HTMLElement {
  injectPanelStyles();

  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel instanceof HTMLElement) {
    updatePanel(existingPanel);
    return existingPanel;
  }

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.style.position = "relative";

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.className = "wand-panel__toggle";
  toggle.setAttribute("aria-label", "Toggle Wand panel");
  toggle.textContent = "▲";
  toggle.addEventListener("click", () => {
    collapsed = !collapsed;
    panel.classList.toggle(COLLAPSED_CLASS, collapsed);
    toggle.textContent = collapsed ? "▲" : "▼";
    toggle.setAttribute("aria-label", collapsed ? "Expand Wand panel" : "Collapse Wand panel");
  });
  panel.append(toggle);
  document.addEventListener("pointerdown", (event) => {
    closeSupportedErrorsWhenClickingElsewhere(panel, event.target);
  });

  if (onRemediate || onResolve) {
    panel.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.id === ACTION_ID) {
        onRemediate?.();
      }

      if (target?.id === RESOLVE_ID) {
        onResolve?.();
      }

      const workspaceAction = target?.getAttribute(WORKSPACE_ACTION_ATTRIBUTE) as WorkspaceAction | null;
      if (workspaceAction) {
        onWorkspaceAction?.(workspaceAction);
      }
    });
  }
  window.addEventListener("wand:workspace-state", (event) => {
    const active = event instanceof CustomEvent ? Boolean(event.detail?.active) : false;
    workspaceActive = active;
    renderPanel(panel, lastSnapshot);
  });
  updatePanel(panel);
  document.documentElement.append(panel);
  return panel;
}

function updatePanel(panel: HTMLElement): void {
  panel.setAttribute("aria-label", "Wand extension status");
  renderPanel(panel, null);
}

export function updatePanelSnapshot(panel: HTMLElement, snapshot: PageSnapshot): void {
  panel.setAttribute("aria-label", "Wand extension status");
  lastSnapshot = snapshot;
  renderPanel(panel, snapshot);
}

function renderPanel(panel: HTMLElement, snapshot: PageSnapshot | null): void {
  const toggle = panel.querySelector(`#${TOGGLE_ID}`);
  panel.replaceChildren(createLabel(), createMainContent(snapshot), createVersion());
  if (toggle instanceof HTMLElement) {
    panel.prepend(toggle);
  }
}

function createLabel(): HTMLElement {
  const header = document.createElement("div");
  header.className = "wand-panel__header";

  const icon = document.createElement("img");
  icon.className = "wand-panel__icon";
  icon.src = ICON_URL;
  icon.alt = "";

  const label = document.createElement("div");
  label.className = "wand-panel__label";
  label.textContent = PANEL_TITLE;

  header.replaceChildren(icon, label);
  return header;
}

function createMeta(statusText: string): HTMLElement {
  const meta = document.createElement("div");
  meta.className = "wand-panel__meta";
  meta.textContent = statusText;
  return meta;
}

function createStatus(snapshot: PageSnapshot): HTMLElement {
  const status = createMeta(getSnapshotStatus(snapshot));
  status.classList.add(getStatusClass(snapshot));
  return status;
}

function createMainContent(snapshot: PageSnapshot | null): HTMLElement {
  const main = document.createElement("div");
  main.className = "wand-panel__main";

  if (busy) {
    main.append(createBusyState());
    return main;
  }

  if (workspaceActive) {
    main.append(createWorkspaceAction(snapshot));
    return main;
  }

  if (!snapshot) {
    main.append(createGuidance("Wand ready", "info"));
    return main;
  }

  if (snapshot.pageKind !== "udoit") {
    main.append(createGuidance("Wand ready", "info"));
    return main;
  }

  if (snapshot.udoitView === "scorecard") {
    main.append(createGuidanceWithSupportedErrors("Please select an issue type to use Wand.", "needed"));
    return main;
  }

  if (snapshot.udoitView === "fixModal" && snapshot.activeIssueType && !isSupportedRemediation(snapshot.activeIssueType)) {
    main.append(createGuidanceWithSupportedErrors("Format issue not supported yet. If you'd like support, flag it to the team!", "error"));
    return main;
  }

  if (snapshot.udoitView === "fixModal" && !snapshot.remediation) {
    main.append(createGuidanceWithSupportedErrors("Wand couldn't identify this format issue. Please flag it to the team!", "error"));
    return main;
  }

  if (!snapshot.remediation) {
    main.append(createGuidanceWithSupportedErrors("Open a Review item to remediate it with Wand.", "needed"));
    return main;
  }

  const button = document.createElement("button");
  button.id = ACTION_ID;
  button.type = "button";
  button.textContent = getActionLabel(snapshot.remediation.issueType);
  main.append(button);
  return main;
}

function createWorkspaceAction(snapshot: PageSnapshot | null): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "wand-panel__workspace-action";

  const definition = snapshot?.remediation
    ? getRemediationDefinition(snapshot.remediation.issueType)
    : undefined;
  const guidance = createGuidance(
    definition?.workspaceGuidance ?? "Complete the remediation in Canvas, then save your change.",
    "needed"
  );
  const button = document.createElement("button");
  button.id = RESOLVE_ID;
  button.type = "button";
  button.textContent = "Mark as resolved and go to next";

  const controls = document.createElement("div");
  controls.className = "wand-panel__workspace-controls";
  for (const action of definition?.workspaceActions ?? []) {
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "wand-panel__secondary-action";
    actionButton.setAttribute(WORKSPACE_ACTION_ATTRIBUTE, action.action);
    actionButton.textContent = action.label;
    controls.append(actionButton);
  }
  controls.append(button);

  wrapper.replaceChildren(guidance, controls);
  return wrapper;
}

function createVersion(): HTMLElement {
  const version = document.createElement("div");
  version.className = "wand-panel__version";
  version.textContent = VERSION_LABEL;
  return version;
}

function createGuidance(text: string, tone: "error" | "info" | "needed"): HTMLElement {
  const guidance = document.createElement("div");
  guidance.className = `wand-panel__guidance wand-panel__text--${tone}`;
  guidance.textContent = text;
  return guidance;
}

function createGuidanceWithSupportedErrors(text: string, tone: "error" | "info" | "needed"): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "wand-panel__guidance-group";
  wrapper.replaceChildren(createGuidance(text, tone), createSupportedErrors());
  return wrapper;
}

function createSupportedErrors(): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "wand-panel__supported";

  const summary = document.createElement("summary");
  summary.textContent = getSupportedErrorsSummary();

  const list = document.createElement("ul");
  for (const remediation of SUPPORTED_REMEDIATIONS) {
    const item = document.createElement("li");
    item.textContent = remediation;
    list.append(item);
  }

  details.replaceChildren(summary, list);
  return details;
}

function getSupportedErrorsSummary(): string {
  return "In development: Click to show current remediation support";
}

export function setPanelBusy(panel: HTMLElement, active: boolean, label = "Working…"): void {
  busy = active;
  busyLabel = label || "Working…";
  panel.setAttribute("aria-busy", String(active));
  renderPanel(panel, lastSnapshot);
}

function createBusyState(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "wand-panel__busy";

  const label = document.createElement("div");
  label.className = "wand-panel__busy-label";
  label.textContent = busyLabel;

  const track = document.createElement("div");
  track.className = "wand-panel__progress";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", busyLabel);

  const indicator = document.createElement("div");
  indicator.className = "wand-panel__progress-indicator";
  track.append(indicator);
  wrapper.replaceChildren(label, track);
  return wrapper;
}

export function showPanelError(message: string): void {
  showPanelToast(message, "error");
}

export function showPanelSuccess(message: string): void {
  showPanelToast(message, "success");
}

function showPanelToast(message: string, tone: "error" | "success"): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.className = `wand-panel__toast wand-panel__toast--${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.textContent = message;
  document.documentElement.append(toast);

  window.setTimeout(() => toast.remove(), 7000);
}

function closeSupportedErrorsWhenClickingElsewhere(panel: HTMLElement, target: EventTarget | null): void {
  const details = panel.querySelector<HTMLDetailsElement>(".wand-panel__supported[open]");
  if (!details || target instanceof Node && details.contains(target)) {
    return;
  }

  details.open = false;
}

function getStatusClass(snapshot: PageSnapshot): string {
  if (snapshot.pageKind === "unknown") {
    return "wand-panel__text--error";
  }

  if (snapshot.pageKind === "udoit" && !snapshot.remediation) {
    return "wand-panel__text--needed";
  }

  return "wand-panel__text--info";
}

function getSnapshotStatus(snapshot: PageSnapshot): string {
  return `${getPageLabel(snapshot)} ready`;
}

function getPageLabel(snapshot: PageSnapshot): string {
  const pageLabel = snapshot.pageKind === "udoit" ? "UDOIT" : snapshot.pageKind === "canvas" ? "Canvas" : "Unknown page";
  return pageLabel;
}

function getActionLabel(issueType: string): string {
  return getRemediationDefinition(issueType)?.actionLabel ?? "Remediate current issue";
}

function injectPanelStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = panelStyles;
  document.documentElement.append(style);
}
