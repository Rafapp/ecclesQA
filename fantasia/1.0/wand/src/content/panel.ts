export function createPanel(): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = "wand-panel";
  panel.textContent = "Wand";
  document.documentElement.append(panel);
  return panel;
}
