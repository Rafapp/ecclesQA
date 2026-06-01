import panelStyles from "../content.css?raw";
import type { PageSnapshot } from "../shared/types";

const PANEL_ID = "wand-panel";
const STYLE_ID = "wand-panel-style";
const ACTION_ID = "wand-remediate-action";
const PANEL_TITLE = "Wand";
const VERSION_LABEL = "Version 1.0";
const ICON_URL = chrome.runtime.getURL("icons/48.png");

let workspaceActive = false;
let lastSnapshot: PageSnapshot | null = null;

export function createPanel(onRemediate?: () => void): HTMLElement {
  injectPanelStyles();

  const existingPanel = document.getElementById(PANEL_ID);
  if (existingPanel instanceof HTMLElement) {
    updatePanel(existingPanel);
    return existingPanel;
  }

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  if (onRemediate) {
    panel.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.id === ACTION_ID) {
        onRemediate();
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
  panel.replaceChildren(createLabel(), createMainContent(snapshot), createVersion());
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

  if (workspaceActive) {
    main.append(createWorkspaceAction());
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
    main.append(createGuidance("Please select an issue type to use Wand.", "needed"));
    return main;
  }

  if (!snapshot.remediation) {
    main.append(createGuidance("Open a Review item to remediate it with Wand.", "needed"));
    return main;
  }

  const button = document.createElement("button");
  button.id = ACTION_ID;
  button.type = "button";
  button.textContent = getActionLabel(snapshot.remediation.issueType);
  main.append(button);
  return main;
}

function createWorkspaceAction(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "wand-panel__workspace-action";

  const guidance = createGuidance("Awaiting remediation and saving ... or", "needed");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Mark as resolved";

  wrapper.replaceChildren(guidance, button);
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
  if (/styles might be used/i.test(issueType)) {
    return "Remediate styled headings";
  }

  return "Remediate current issue";
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
