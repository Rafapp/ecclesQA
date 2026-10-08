// ── State ─────────────────────────────────────────────────────────────────────

let activeScript  = null;   // manifest entry currently being run
let activeRunId   = null;   // unique id for the active run
let inputValues   = {};     // { [input.id]: string }
let outputValues  = {};     // { [output.id]: string }
let autoApprove   = false;
let unsubscribe   = null;   // IPC listener cleanup
let pendingConfirm = null;  // resolve fn waiting for user Continue/Abort
let outputFolder  = null;   // resolved output folder for "Open Output Folder"
const outputWaitTimers = new Map();
let progressStepKey = null;
let progressStepStartedAt = null;
let progressElapsedTimer = null;
let sorcererJobId = null;
let sorcererPollTimer = null;
let sorcererPrefs = { enabled: false, serverUrl: "", token: "", priority: 50 };

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
  sorcererPrefs = { enabled: !!prefs.sorcererEnabled, serverUrl: prefs.sorcererUrl || "", token: prefs.sorcererToken || "", priority: Number(prefs.sorcererPriority) || 50 };

  renderScripts(scripts);
  wireDialogControls();
  refreshSorcererOverview();
  setInterval(refreshSorcererOverview, 10_000);
  window.magic.onAppClosing(showClosingScreen);
}

function showClosingScreen() {
  document.getElementById("closing-overlay").classList.remove("hidden");
  document.title = "Closing Magic...";
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
  hide("run-progress");
  hide("run-remote-job");
  hide("run-confirm");
  hide("run-footer");

  buildIoFields(script);

  // Sync auto-approve checkbox with persisted pref
  document.getElementById("auto-approve-chk").checked = autoApprove;
  document.getElementById("sorcerer-chk").checked = sorcererPrefs.enabled;
  document.getElementById("sorcerer-url").value = sorcererPrefs.serverUrl;
  document.getElementById("sorcerer-token").value = sorcererPrefs.token;
  document.getElementById("sorcerer-priority").value = sorcererPrefs.priority;
  document.getElementById("sorcerer-fields").classList.toggle("hidden", !sorcererPrefs.enabled);

  show("run-overlay");
}

function closeRunDialog() {
  if (activeRunId) {
    window.magic.abortScript(activeRunId);
    activeRunId = null;
  }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  clearOutputWaitTimers();
  clearProgressElapsedTimer();
  clearTimeout(sorcererPollTimer);
  if (sorcererJobId) {
    window.magic.cancelSorcerer({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: sorcererJobId }).catch(() => {});
    sorcererJobId = null;
  }
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
  document.getElementById("stop-after-current-btn").addEventListener("click", requestStopAfterCurrent);
  document.getElementById("open-output-btn").addEventListener("click", () => {
    if (outputFolder) window.magic.openFolder(outputFolder);
  });
  document.getElementById("sorcerer-refresh-btn").addEventListener("click", refreshSorcererOverview);

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
  document.getElementById("sorcerer-chk").addEventListener("change", (e) => {
    sorcererPrefs.enabled = e.target.checked;
    document.getElementById("sorcerer-fields").classList.toggle("hidden", !e.target.checked);
    window.magic.setPref("sorcererEnabled", sorcererPrefs.enabled);
  });
  for (const [id, key, prefKey] of [["sorcerer-url", "serverUrl", "sorcererUrl"], ["sorcerer-token", "token", "sorcererToken"], ["sorcerer-priority", "priority", "sorcererPriority"]]) {
    document.getElementById(id).addEventListener("change", (e) => {
      sorcererPrefs[key] = key === "priority" ? Math.max(0, Math.min(100, Number(e.target.value) || 50)) : e.target.value.trim();
      window.magic.setPref(prefKey, sorcererPrefs[key]);
    });
  }
}

async function refreshSorcererOverview() {
  const detail = document.getElementById("sorcerer-overview-detail");
  const body = document.getElementById("sorcerer-jobs-body");
  if (!sorcererPrefs.serverUrl || !sorcererPrefs.token) {
    detail.textContent = "Configure a server in a run dialog to view remote jobs.";
    body.innerHTML = `<tr class="placeholder-row"><td colspan="4">No server configured.</td></tr>`;
    return;
  }
  detail.textContent = `Checking ${sorcererPrefs.serverUrl}…`;
  try {
    const { jobs } = await window.magic.getSorcererJobs({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token });
    detail.textContent = `${jobs.length} job${jobs.length === 1 ? "" : "s"} visible to this client.`;
    if (!jobs.length) {
      body.innerHTML = `<tr class="placeholder-row"><td colspan="4">No submitted Sorcerer jobs.</td></tr>`;
      return;
    }
    body.replaceChildren(...jobs.map((job) => {
      const row = document.createElement("tr");
      const jobCell = document.createElement("td");
      jobCell.textContent = `${job.type} · ${job.id.slice(0, 8)}`;
      const workflow = document.createElement("strong");
      workflow.textContent = `${job.type} (attempt ${job.attempt || 1})`;
      const jobId = document.createElement("button");
      jobId.type = "button";
      jobId.className = "job-id";
      jobId.textContent = job.id;
      jobId.title = "Copy job ID";
      jobId.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(job.id);
          detail.textContent = `Copied job ID ${job.id}.`;
        } catch {
          detail.textContent = "Select and copy the job ID manually.";
        }
      });
      jobCell.replaceChildren(workflow, jobId);
      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = `job-status job-status--${String(job.status).replace(/[^a-z]/g, "")}`;
      status.textContent = job.status;
      statusCell.appendChild(status);
      const messageCell = document.createElement("td");
      messageCell.textContent = job.message || "—";
      const actionsCell = document.createElement("td");
      actionsCell.className = "job-actions";
      if (["queued", "running"].includes(job.status)) {
        const cancel = document.createElement("button");
        cancel.className = "btn btn--danger";
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", async () => {
          if (!confirm(`Request cancellation for job ${job.id}? A running workflow stops at the next safe process boundary.`)) return;
          cancel.disabled = true;
          try {
            await window.magic.cancelSorcerer({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: job.id });
            detail.textContent = `Cancellation requested for ${job.id}.`;
          }
          catch (error) { alert(`Could not cancel job: ${error.message}`); }
          refreshSorcererOverview();
        });
        actionsCell.appendChild(cancel);
      } else {
        const requeue = document.createElement("button");
        requeue.className = "btn btn--secondary";
        requeue.type = "button";
        requeue.textContent = "Requeue as next attempt";
        requeue.addEventListener("click", async () => {
          if (!confirm(`Requeue job ${job.id} as a new attempt? The original input remains available. Completed result archives are preserved before the new attempt replaces the current result.`)) return;
          requeue.disabled = true;
          try {
            await window.magic.requeueSorcerer({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: job.id });
            detail.textContent = `Requeued ${job.id} as its next attempt.`;
          }
          catch (error) { alert(`Could not requeue job: ${error.message}`); }
          refreshSorcererOverview();
        });
        actionsCell.appendChild(requeue);
      }
      row.append(jobCell, statusCell, messageCell, actionsCell);
      return row;
    }));
  } catch (error) {
    detail.textContent = `Sorcerer unavailable: ${error.message}`;
    body.innerHTML = `<tr class="placeholder-row"><td colspan="4">Could not load server jobs.</td></tr>`;
  }
}

function requestStopAfterCurrent() {
  if (!activeRunId) return;
  const button = document.getElementById("stop-after-current-btn");
  button.disabled = true;
  button.textContent = "Stopping after current file";
  if (sorcererJobId) {
    window.magic.cancelSorcerer({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: sorcererJobId })
      .then(() => finishRun("Sorcerer job cancelled.", false))
      .catch((error) => finishRun(error.message, true));
  } else window.magic.stopAfterCurrent(activeRunId);
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
  show("run-progress");
  show("run-timeline");
  buildTimeline(script.steps || []);
  document.getElementById("stop-after-current-btn").classList.toggle("hidden", !script.supportsStopAfterCurrent);
  document.getElementById("stop-after-current-btn").disabled = false;
  document.getElementById("stop-after-current-btn").textContent = "Stop after current file";

  if (sorcererPrefs.enabled) {
    sorcererPrefs.serverUrl = document.getElementById("sorcerer-url").value.trim();
    sorcererPrefs.token = document.getElementById("sorcerer-token").value.trim();
    sorcererPrefs.priority = Math.max(0, Math.min(100, Number(document.getElementById("sorcerer-priority").value) || 50));
    window.magic.setPref("sorcererUrl", sorcererPrefs.serverUrl);
    window.magic.setPref("sorcererToken", sorcererPrefs.token);
    window.magic.setPref("sorcererPriority", sorcererPrefs.priority);
    if (!sorcererPrefs.serverUrl || !sorcererPrefs.token) {
      finishRun("Enter the Sorcerer server URL and client access token.", true);
      return;
    }
    try {
      const sourceField = (script.inputs || []).find((field) => field.type === "folder");
      const job = await window.magic.submitSorcerer({
        serverUrl: sorcererPrefs.serverUrl,
        token: sorcererPrefs.token,
        jobType: script.id,
        sourceFolder: inputValues[sourceField?.id],
        metadata: { output_name: outputValues.output_name },
        priority: sorcererPrefs.priority,
      });
      sorcererJobId = job.id;
      showRemoteJobId(job.id);
      appendToLastRunningStep("Submitted to Sorcerer. The full copyable job ID is shown above while the job is active.");
      pollSorcererJob();
    } catch (error) {
      finishRun(`Could not submit to Sorcerer: ${error.message}`, true);
    }
    return;
  }

  // Subscribe to local workflow events
  if (unsubscribe) unsubscribe();
  unsubscribe = window.magic.onScriptEvent(handleScriptEvent);

  window.magic.runScript(activeRunId, script.scriptFile, args);
}

async function pollSorcererJob() {
  if (!sorcererJobId || !activeRunId) return;
  try {
    const job = await window.magic.getSorcererJob({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: sorcererJobId });
    if (job.progress?.type) handleScriptEvent({ ...job.progress, runId: activeRunId });
    if (job.status === "completed") {
      appendToLastRunningStep("Downloading completed files from Sorcerer.");
      await window.magic.downloadSorcerer({ serverUrl: sorcererPrefs.serverUrl, token: sorcererPrefs.token, jobId: sorcererJobId, outputFolder });
      sorcererJobId = null;
      refreshSorcererOverview();
      return finishRun("Sorcerer completed the job and downloaded the output.", false);
    }
    if (job.status === "failed" || job.status === "cancelled") {
      sorcererJobId = null;
      refreshSorcererOverview();
      return finishRun(job.message || `Sorcerer job ${job.status}.`, job.status === "failed");
    }
    sorcererPollTimer = setTimeout(pollSorcererJob, 2000);
  } catch (error) {
    sorcererJobId = null;
    finishRun(`Lost contact with Sorcerer: ${error.message}`, true);
  }
}

// ── Timeline builder ──────────────────────────────────────────────────────────

function buildTimeline(steps) {
  resetProgress();
  clearOutputWaitTimers();
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
          <div class="timeline-stream-status">
            <span class="timeline-stream-pulse" aria-hidden="true"></span>
            <span class="timeline-stream-status-text">Waiting for output...</span>
          </div>
        </div>`;
      return li;
    })
  );
}

function resetProgress() {
  updateProgress(0, 0, "Waiting for the workflow to begin.", 1, 1, "Preparing workflow", 1, 1, "Waiting to begin", false);
}

function setDeterminateProgress(fillId, percentage) {
  const fill = document.getElementById(fillId);
  fill.style.width = `${percentage}%`;
}

function setIndeterminateProgress(fillId) {
  const fill = document.getElementById(fillId);
  fill.style.width = "100%";
}

function updateProgress(
  fileCurrent,
  fileTotal,
  fileName,
  taskCurrent,
  taskTotal,
  taskName,
  stepCurrent,
  stepTotal,
  stepName,
  stepDeterminate
) {
  const safeFileTotal = Math.max(0, Number(fileTotal) || 0);
  const safeFileCurrent = Math.min(Math.max(0, Number(fileCurrent) || 0), safeFileTotal || Number.MAX_SAFE_INTEGER);
  const filePercentage = safeFileTotal ? Math.round((safeFileCurrent / safeFileTotal) * 100) : 0;
  const safeTaskTotal = Math.max(1, Number(taskTotal) || 1);
  const safeTaskCurrent = Math.min(Math.max(1, Number(taskCurrent) || 1), safeTaskTotal);
  const taskPercentage = Math.round((safeTaskCurrent / safeTaskTotal) * 100);
  const safeStepTotal = Math.max(1, Number(stepTotal) || 1);
  const safeStepCurrent = Math.min(Math.max(1, Number(stepCurrent) || 1), safeStepTotal);
  const stepPercentage = Math.round((safeStepCurrent / safeStepTotal) * 100);
  const count = document.getElementById("run-progress-count");
  const fileTrack = document.querySelector(".run-progress__track");
  const taskTrack = document.getElementById("run-task-progress");
  const stepTrack = document.getElementById("run-step-progress");
  const stepKey = `${safeFileCurrent}\u0000${fileName}\u0000${taskName}\u0000${stepName}`;

  if (stepKey !== progressStepKey) {
    progressStepKey = stepKey;
    progressStepStartedAt = Date.now();
    startProgressElapsedTimer();
  }

  count.textContent = safeFileTotal ? `${safeFileCurrent} / ${safeFileTotal} (${filePercentage}%)` : "Preparing";
  setDeterminateProgress("run-progress-fill", filePercentage);
  const fileValue = document.getElementById("run-progress-file");
  const taskValue = document.getElementById("run-progress-task");
  const stepValue = document.getElementById("run-progress-step");
  fileValue.textContent = fileName;
  fileValue.title = fileName;
  document.getElementById("run-task-count").textContent = `${safeTaskCurrent} / ${safeTaskTotal} (${taskPercentage}%)`;
  taskValue.textContent = taskName;
  taskValue.title = taskName;
  setDeterminateProgress("run-task-progress-fill", taskPercentage);
  taskTrack.setAttribute("aria-valuemax", String(safeTaskTotal));
  taskTrack.setAttribute("aria-valuenow", String(safeTaskCurrent));
  document.getElementById("run-step-count").textContent = stepDeterminate
    ? `${safeStepCurrent} / ${safeStepTotal} (${stepPercentage}%)`
    : `${safeStepCurrent} / ${safeStepTotal} - Working`;
  stepValue.textContent = stepName;
  stepValue.title = stepName;
  stepTrack.classList.toggle("is-indeterminate", !stepDeterminate);
  if (stepDeterminate) {
    setDeterminateProgress("run-step-progress-fill", stepPercentage);
  } else {
    setIndeterminateProgress("run-step-progress-fill");
  }
  if (stepDeterminate) {
    stepTrack.setAttribute("aria-valuemin", "0");
    stepTrack.setAttribute("aria-valuemax", String(safeStepTotal));
    stepTrack.setAttribute("aria-valuenow", String(safeStepCurrent));
    stepTrack.removeAttribute("aria-valuetext");
  } else {
    stepTrack.removeAttribute("aria-valuemin");
    stepTrack.removeAttribute("aria-valuemax");
    stepTrack.removeAttribute("aria-valuenow");
    stepTrack.setAttribute("aria-valuetext", "In progress");
  }
  fileTrack.setAttribute("aria-valuemax", String(safeFileTotal));
  fileTrack.setAttribute("aria-valuenow", String(safeFileCurrent));
  if (safeFileTotal) document.title = `${safeFileCurrent}/${safeFileTotal} - ${fileName} - Magic`;
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateProgressElapsed() {
  const elapsed = document.getElementById("run-progress-elapsed");
  if (elapsed && progressStepStartedAt !== null) {
    elapsed.textContent = formatElapsed(Date.now() - progressStepStartedAt);
  }
}

function startProgressElapsedTimer() {
  clearInterval(progressElapsedTimer);
  updateProgressElapsed();
  progressElapsedTimer = setInterval(updateProgressElapsed, 1000);
}

function clearProgressElapsedTimer() {
  clearInterval(progressElapsedTimer);
  progressElapsedTimer = null;
  progressStepKey = null;
  progressStepStartedAt = null;
}

function getTimelineItem(stepId) {
  return document.querySelector(`[data-step-id="${stepId}"]`);
}

function setStepState(stepId, state) {
  const el = getTimelineItem(stepId);
  if (el) el.dataset.state = state;
  if (state !== "running") {
    clearTimeout(outputWaitTimers.get(stepId));
    outputWaitTimers.delete(stepId);
  }
}

function clearOutputWaitTimers() {
  outputWaitTimers.forEach((timer) => clearTimeout(timer));
  outputWaitTimers.clear();
}

function formatLogTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function markOutputReceived(stepEl, receivedAt) {
  const stepId = stepEl.dataset.stepId;
  const status = stepEl.querySelector(".timeline-stream-status");
  const statusText = stepEl.querySelector(".timeline-stream-status-text");
  if (!status || !statusText) return;

  clearTimeout(outputWaitTimers.get(stepId));
  status.classList.add("is-receiving");
  statusText.textContent = `Output received at ${formatLogTime(receivedAt)}`;
  outputWaitTimers.set(stepId, setTimeout(() => {
    status.classList.remove("is-receiving");
    statusText.textContent = "Waiting for next output...";
    outputWaitTimers.delete(stepId);
  }, 1200));
}

function appendTimelineLogLine(stepEl, message) {
  const receivedAt = new Date();
  const log = stepEl.querySelector(".timeline-log");
  const line = document.createElement("div");
  const timestamp = document.createElement("time");
  const content = document.createElement("span");

  line.className = "timeline-log-line";
  timestamp.className = "timeline-log-time";
  timestamp.dateTime = receivedAt.toISOString();
  timestamp.textContent = formatLogTime(receivedAt);
  content.className = "timeline-log-message";
  content.textContent = message;
  line.append(timestamp, content);
  log.appendChild(line);
  markOutputReceived(stepEl, receivedAt);
  scrollTimelineToLatest();
}

function appendStepLog(stepId, message) {
  const el = getTimelineItem(stepId);
  if (!el) return;
  appendTimelineLogLine(el, message);
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
  markOutputReceived(el, new Date());
  scrollTimelineToLatest();
}

function scrollTimelineToLatest() {
  const timeline = document.getElementById("run-timeline");
  requestAnimationFrame(() => {
    timeline.scrollTop = timeline.scrollHeight;
  });
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

    case "run_stopped":
      finishRun(payload.message || "Stopped after the current file.", false);
      break;

    case "progress":
      updateProgress(
        payload.fileCurrent,
        payload.fileTotal,
        payload.file,
        payload.taskCurrent,
        payload.taskTotal,
        payload.task,
        payload.stepCurrent,
        payload.stepTotal,
        payload.step,
        payload.stepDeterminate
      );
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
  if (running) appendTimelineLogLine(running, message);
}

function showRemoteJobId(jobId) {
  const panel = document.getElementById("run-remote-job");
  const button = document.getElementById("run-remote-job-id");
  button.textContent = jobId;
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(jobId);
      document.getElementById("run-remote-job-note").textContent = "Job ID copied. Include it in a support request, never your token.";
    } catch {
      document.getElementById("run-remote-job-note").textContent = "Select and copy the job ID manually.";
    }
  };
  show("run-remote-job");
}

// ── Finish ────────────────────────────────────────────────────────────────────

function finishRun(message, isError) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  clearOutputWaitTimers();
  clearProgressElapsedTimer();
  clearTimeout(sorcererPollTimer);
  activeRunId = null;
  hide("run-confirm");
  hide("stop-after-current-btn");

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
