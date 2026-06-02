// ── State ─────────────────────────────────────────────────────────────────────

let activeScript  = null;   // manifest entry currently being run
let activeRunId   = null;   // unique id for the active run
let inputValues   = {};     // { [input.id]: string }
let outputValues  = {};     // { [output.id]: string }
let autoApprove   = false;
let unsubscribe   = null;   // IPC listener cleanup
let pendingConfirm = null;  // resolve fn waiting for user Continue/Abort
let outputFolder  = null;   // resolved output folder for "Open Output Folder"

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const [version, scripts, prefs] = await Promise.all([
    window.magic.getVersion(),
    window.magic.getScripts(),
    window.magic.getPrefs(),
  ]);

  document.getElementById("app-title").textContent = `Magic v${version}`;
  document.title = `Magic v${version}`;

  autoApprove = !!prefs.autoApprove;

  renderScripts(scripts);
  wireDialogControls();
}

// ── Scripts table ─────────────────────────────────────────────────────────────

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
        <td><span class="script-name">${esc(script.name)}</span></td>
        <td><span class="script-desc">${esc(script.description)}</span></td>
        <td class="col-action">
          <button class="btn btn--primary launch-btn" type="button">Launch</button>
        </td>`;
      tr.querySelector(".launch-btn").addEventListener("click", () => openRunDialog(script));
      return tr;
    })
  );
}

// ── Run dialog: open / close ──────────────────────────────────────────────────

function openRunDialog(script) {
  activeScript  = script;
  inputValues   = {};
  outputValues  = {};
  outputFolder  = null;

  document.getElementById("run-title").textContent = script.name;

  // Show config, hide timeline/confirm/footer
  show("run-config");
  hide("run-timeline");
  hide("run-confirm");
  hide("run-footer");

  buildIoFields(script);

  // Sync auto-approve checkbox with persisted pref
  document.getElementById("auto-approve-chk").checked = autoApprove;

  show("run-overlay");
}

function closeRunDialog() {
  if (activeRunId) {
    window.magic.abortScript(activeRunId);
    activeRunId = null;
  }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  pendingConfirm = null;
  hide("run-overlay");
}

// ── I/O field builder ─────────────────────────────────────────────────────────

function buildIoFields(script) {
  const inputsEl  = document.getElementById("run-inputs");
  const outputsEl = document.getElementById("run-outputs");
  inputsEl.replaceChildren();
  outputsEl.replaceChildren();

  if (script.inputs?.length) {
    inputsEl.appendChild(buildIoGroup("Inputs", script.inputs, "input"));
  }
  if (script.outputs?.length) {
    outputsEl.appendChild(buildIoGroup("Outputs", script.outputs, "output"));
  }
}

function buildIoGroup(heading, fields, kind) {
  const group = document.createElement("div");
  group.className = "io-group";
  const h = document.createElement("div");
  h.className = "io-group__heading";
  h.textContent = heading;
  group.appendChild(h);

  fields.forEach((field) => {
    group.appendChild(buildIoField(field, kind));
  });
  return group;
}

function buildIoField(field, kind) {
  const wrap = document.createElement("div");
  wrap.className = "io-field";

  const label = document.createElement("div");
  label.className = "io-field__label";
  label.textContent = field.label + (field.required ? " *" : "");
  wrap.appendChild(label);

  if (field.description) {
    const desc = document.createElement("div");
    desc.className = "io-field__desc";
    desc.textContent = field.description;
    wrap.appendChild(desc);
  }

  const row = document.createElement("div");
  row.className = "io-field__row";

  if (field.type === "folder") {
    const path = document.createElement("span");
    path.className = "io-path";
    path.textContent = "No folder selected";

    const btn = document.createElement("button");
    btn.className = "btn btn--secondary";
    btn.type = "button";
    btn.textContent = "Browse…";
    btn.addEventListener("click", async () => {
      const folder = await window.magic.pickFolder();
      if (!folder) return;
      path.textContent = folder;
      path.classList.add("has-value");
      if (kind === "input") inputValues[field.id] = folder;
      else                  outputValues[field.id] = folder;
    });

    row.appendChild(path);
    row.appendChild(btn);

  } else if (field.type === "filename") {
    const input = document.createElement("input");
    input.className = "io-name-input";
    input.type = "text";
    input.value = field.default || "";
    input.spellcheck = false;
    outputValues[field.id] = input.value;
    input.addEventListener("input", () => { outputValues[field.id] = input.value.trim(); });

    const ext = document.createElement("span");
    ext.className = "io-ext";
    ext.textContent = field.extension || "";

    row.appendChild(input);
    row.appendChild(ext);
  }

  wrap.appendChild(row);
  return wrap;
}

// ── Dialog controls wiring ────────────────────────────────────────────────────

function wireDialogControls() {
  document.getElementById("run-close").addEventListener("click", closeRunDialog);
  document.getElementById("run-cancel-btn").addEventListener("click", closeRunDialog);
  document.getElementById("run-launch-btn").addEventListener("click", launchScript);
  document.getElementById("run-done-btn").addEventListener("click", closeRunDialog);
  document.getElementById("open-output-btn").addEventListener("click", () => {
    if (outputFolder) window.magic.openFolder(outputFolder);
  });

  document.getElementById("confirm-continue-btn").addEventListener("click", () => {
    if (pendingConfirm) { pendingConfirm(true); pendingConfirm = null; }
    hide("run-confirm");
  });
  document.getElementById("confirm-abort-btn").addEventListener("click", () => {
    if (pendingConfirm) { pendingConfirm(false); pendingConfirm = null; }
    hide("run-confirm");
    window.magic.abortScript(activeRunId);
    finishRun("Aborted by user.", true);
  });

  document.getElementById("auto-approve-chk").addEventListener("change", (e) => {
    autoApprove = e.target.checked;
    window.magic.setPref("autoApprove", autoApprove);
  });
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateInputs(script) {
  const errors = [];
  for (const field of (script.inputs || [])) {
    if (field.required && !inputValues[field.id]) {
      errors.push(`"${field.label}" is required.`);
    }
  }
  for (const field of (script.outputs || [])) {
    if (field.required) {
      const val = outputValues[field.id];
      if (!val || !val.trim()) errors.push(`"${field.label}" is required.`);
    }
  }
  return errors;
}

function sanitizeFilename(raw) {
  return raw.replace(/\.xlsx$/i, "").replace(/[\\/*?:<>|"]/g, "_").trim() || "Output";
}

// ── Script launch ─────────────────────────────────────────────────────────────

async function launchScript() {
  const script = activeScript;
  const errors = validateInputs(script);
  if (errors.length) {
    alert("Please fix the following before running:\n\n" + errors.join("\n"));
    return;
  }

  // Build argv: inputs in manifest order, then outputs in manifest order
  // Filename outputs are sanitized
  const args = [];
  for (const field of (script.inputs || [])) {
    args.push(inputValues[field.id] || "");
  }
  for (const field of (script.outputs || [])) {
    let val = outputValues[field.id] || "";
    if (field.type === "filename") val = sanitizeFilename(val);
    args.push(val);
  }

  // Capture the output folder for "Open Output Folder"
  const outputFolderField = (script.outputs || []).find((f) => f.type === "folder");
  outputFolder = outputFolderField ? outputValues[outputFolderField.id] : null;

  activeRunId = `run-${Date.now()}`;

  // Build timeline
  hide("run-config");
  show("run-timeline");
  buildTimeline(script.steps || []);

  // Subscribe to events
  if (unsubscribe) unsubscribe();
  unsubscribe = window.magic.onScriptEvent(handleScriptEvent);

  window.magic.runScript(activeRunId, script.scriptFile, args);
}

// ── Timeline builder ──────────────────────────────────────────────────────────

function buildTimeline(steps) {
  const list = document.getElementById("timeline-list");
  list.replaceChildren(
    ...steps.map((step, i) => {
      const li = document.createElement("li");
      li.className = "timeline-item";
      li.dataset.stepId = step.id;
      li.dataset.state = "pending";

      li.innerHTML = `
        <div class="timeline-dot">${i + 1}</div>
        <div class="timeline-body">
          <div class="timeline-label">
            <span class="step-spinner"></span>
            <span class="step-label-text">${esc(step.label)}</span>
          </div>
          <div class="timeline-log"></div>
        </div>`;
      return li;
    })
  );
}

function getTimelineItem(stepId) {
  return document.querySelector(`[data-step-id="${stepId}"]`);
}

function setStepState(stepId, state) {
  const el = getTimelineItem(stepId);
  if (el) el.dataset.state = state;
}

function appendStepLog(stepId, message) {
  const el = getTimelineItem(stepId);
  if (!el) return;
  const log = el.querySelector(".timeline-log");
  const line = document.createElement("div");
  line.className = "timeline-log-line";
  line.textContent = message;
  log.appendChild(line);
  line.scrollIntoView({ block: "nearest" });
}

function appendStepItems(stepId, items) {
  const el = getTimelineItem(stepId);
  if (!el) return;
  const log = el.querySelector(".timeline-log");
  const ul = document.createElement("ul");
  ul.className = "timeline-items-list";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });
  log.appendChild(ul);
  ul.scrollIntoView({ block: "nearest" });
}

// ── Confirm panel ─────────────────────────────────────────────────────────────

function showConfirm(message, items) {
  return new Promise((resolve) => {
    document.getElementById("confirm-message").textContent = message;
    const ul = document.getElementById("confirm-items");
    ul.replaceChildren(
      ...(items || []).map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      })
    );
    show("run-confirm");
    pendingConfirm = resolve;
  });
}

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleScriptEvent(payload) {
  if (payload.runId !== activeRunId) return;

  switch (payload.type) {
    case "step_start":
      setStepState(payload.id, "running");
      break;

    case "step_info": {
      appendStepLog(payload.id, payload.message);
      if (payload.items?.length) appendStepItems(payload.id, payload.items);

      if (payload.confirm) {
        if (autoApprove) {
          window.magic.continueScript(activeRunId);
        } else {
          const proceed = await showConfirm(payload.message, payload.items);
          if (proceed) {
            window.magic.continueScript(activeRunId);
          }
          // abort path: the confirm-abort-btn listener already called abortScript
        }
      }
      break;
    }

    case "step_done":
      setStepState(payload.id, "done");
      break;

    case "step_error":
      setStepState(payload.id, "error");
      appendStepLog(payload.id, payload.message);
      finishRun(payload.message, true);
      break;

    case "run_error":
      finishRun(payload.message, true);
      break;

    case "run_done":
      finishRun(payload.message || "Completed successfully.", false);
      break;

    case "log":
      // Append to the most recently running step, or just surface it
      appendToLastRunningStep(payload.message);
      break;

    case "process-exit":
      // If no explicit run_done/run_error came through, handle exit code
      if (!document.getElementById("run-footer").classList.contains("hidden")) break;
      if (payload.code !== 0) finishRun(`Process exited with code ${payload.code}`, true);
      break;
  }
}

function appendToLastRunningStep(message) {
  const running = document.querySelector('[data-state="running"]');
  if (running) {
    const log = running.querySelector(".timeline-log");
    const line = document.createElement("div");
    line.className = "timeline-log-line";
    line.textContent = message;
    log.appendChild(line);
  }
}

// ── Finish ────────────────────────────────────────────────────────────────────

function finishRun(message, isError) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  activeRunId = null;
  hide("run-confirm");

  const msg = document.getElementById("run-result-msg");
  msg.textContent = message;
  msg.className = "run-result-msg" + (isError ? " is-error" : "");

  const openBtn = document.getElementById("open-output-btn");
  openBtn.classList.toggle("hidden", !outputFolder || isError);

  show("run-footer");
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", init);
