let selectedFolder = null;

async function init() {
  const version = await window.magic.getVersion();
  document.getElementById("app-title").textContent = `Magic v${version}`;
  document.title = `Magic v${version}`;

  const scripts = await window.magic.getScripts();
  renderScripts(scripts);

  document.getElementById("pick-folder-btn").addEventListener("click", pickFolder);
  document.getElementById("output-close").addEventListener("click", closeOutput);
  document.getElementById("output-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeOutput();
  });
}

function renderScripts(scripts) {
  const tbody = document.getElementById("scripts-body");
  if (!scripts.length) {
    tbody.innerHTML = `<tr class="placeholder-row"><td colspan="3">No scripts available.</td></tr>`;
    return;
  }

  tbody.replaceChildren(
    ...scripts.map((script) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="script-name">${escapeHtml(script.name)}</span></td>
        <td><span class="script-desc">${escapeHtml(script.description)}</span></td>
        <td class="col-action">
          <button class="btn btn--primary launch-btn" type="button" data-id="${escapeHtml(script.id)}">
            Launch
          </button>
        </td>
      `;
      tr.querySelector(".launch-btn").addEventListener("click", () => runScript(script, tr));
      return tr;
    })
  );
}

async function pickFolder() {
  const folder = await window.magic.pickFolder();
  if (!folder) return;
  selectedFolder = folder;
  const el = document.getElementById("folder-path");
  el.textContent = folder;
  el.classList.add("has-path");
}

async function runScript(script, row) {
  const btn = row.querySelector(".launch-btn");
  btn.disabled = true;
  btn.textContent = "Running…";
  btn.classList.replace("btn--primary", "btn--running");

  const result = await window.magic.runScript(script.scriptFile, selectedFolder);

  btn.disabled = false;
  btn.textContent = "Launch";
  btn.classList.replace("btn--running", "btn--primary");

  showOutput(script.name, result);
}

function showOutput(scriptName, result) {
  const overlay = document.getElementById("output-overlay");
  const title = document.getElementById("output-title");
  const body = document.getElementById("output-body");

  const exitOk = result.code === 0;
  const text = (result.output || "") + (result.error ? `\n[stderr]\n${result.error}` : "");
  const statusLine = `Exit code: ${result.code}\n${"─".repeat(40)}\n`;

  title.textContent = `Output — ${scriptName}`;
  body.textContent = statusLine + (text.trim() || "(no output)");
  body.className = `output-dialog__body ${exitOk ? "exit-ok" : "exit-err"}`;

  overlay.classList.remove("hidden");
  overlay.focus();
}

function closeOutput() {
  document.getElementById("output-overlay").classList.add("hidden");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", init);
