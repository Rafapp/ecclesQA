const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const http = require("http");
const https = require("https");

const APP_VERSION = app.getVersion();

// ── Paths ─────────────────────────────────────────────────────────────────────

function resolvePython() {
  const bundled = path.join(process.resourcesPath, "python", "python.exe");
  return fs.existsSync(bundled) ? bundled : "python";
}

function resolveScriptsDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "scripts")
    : path.join(__dirname, "..", "scripts");
}

// ── Preferences ───────────────────────────────────────────────────────────────

const PREFS_PATH = path.join(app.getPath("userData"), "prefs.json");
const LOG_PATH = path.join(app.getPath("userData"), "magic.log");

function writeLog(event, details = {}) {
  try {
    fs.appendFileSync(
      LOG_PATH,
      `${JSON.stringify({ time: new Date().toISOString(), event, ...details })}\n`,
      "utf-8"
    );
  } catch {}
}

function loadPrefs() {
  try {
    return JSON.parse(fs.readFileSync(PREFS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2), "utf-8");
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  let closeInProgress = false;
  let allowClose = false;
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 720,
    minHeight: 480,
    title: `Magic v${APP_VERSION}`,
    icon: path.join(__dirname, "..", "icons", "256.png"),
    backgroundColor: "#f5f5f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.on("close", (event) => {
    writeLog("window-close-requested", { activeRuns: activeProcs.size });
    if (allowClose || activeProcs.size === 0) return;
    event.preventDefault();
    if (closeInProgress) return;
    closeInProgress = true;
    win.webContents.send("app-closing");
    setTimeout(() => {
      for (const run of activeProcs.values()) terminateRun(run);
      activeProcs.clear();
      allowClose = true;
      win.close();
    }, 250);
  });
  win.on("closed", () => writeLog("window-closed"));
  win.webContents.on("render-process-gone", (_event, details) => {
    writeLog("renderer-process-gone", {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
  writeLog("window-created", { version: APP_VERSION });
  return win;
}

// ── IPC: basic ────────────────────────────────────────────────────────────────

ipcMain.handle("get-version", () => APP_VERSION);

ipcMain.handle("get-scripts", () => {
  const manifestPath = path.join(__dirname, "scripts-manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-folder", async (_event, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    await shell.openPath(folderPath);
    return { ok: true };
  }
  return { ok: false, error: "Folder not found" };
});

ipcMain.handle("get-prefs", () => loadPrefs());

ipcMain.handle("set-pref", (_event, { key, value }) => {
  const prefs = loadPrefs();
  prefs[key] = value;
  savePrefs(prefs);
});

// â”€â”€ Sorcerer LAN client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function requestSorcerer(serverUrl, token, method, pathname, body, headers = {}) {
  const base = new URL(serverUrl);
  if (!/^https?:$/.test(base.protocol)) throw new Error("Sorcerer URL must use http or https.");
  const client = base.protocol === "https:" ? https : http;
  const requestPath = new URL(pathname, base).pathname;
  return new Promise((resolve, reject) => {
    const req = client.request({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || (base.protocol === "https:" ? 443 : 80),
      path: requestPath,
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers, ...(body ? { "Content-Length": body.length } : {}) },
      timeout: 30_000,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const data = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let message = `Sorcerer request failed (${res.statusCode}).`;
          try { message = JSON.parse(data.toString()).error || message; } catch {}
          reject(new Error(message));
        } else resolve({ data, contentType: res.headers["content-type"] });
      });
    });
    req.on("timeout", () => req.destroy(new Error("Sorcerer did not respond in time.")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function runPowerShell(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script, ...args], { windowsHide: true });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.trim() || `PowerShell exited with code ${code}.`)));
  });
}

async function createSourceArchive(sourceFolder) {
  const stat = await fsp.stat(sourceFolder);
  if (!stat.isDirectory()) throw new Error("Sorcerer source must be a folder.");
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "magic-sorcerer-"));
  const archive = path.join(tempDir, "input.zip");
  await runPowerShell("param($source,$archive) Compress-Archive -Path (Join-Path $source '*') -DestinationPath $archive -Force", [sourceFolder, archive]);
  return { tempDir, archive };
}

ipcMain.handle("sorcerer-submit", async (_event, payload) => {
  const { serverUrl, token, jobType, sourceFolder, metadata = {}, priority = 50 } = payload;
  if (!token || !jobType || !sourceFolder) throw new Error("Sorcerer server, token, job type, and source folder are required.");
  const { tempDir, archive } = await createSourceArchive(sourceFolder);
  try {
    const body = await fsp.readFile(archive);
    const response = await requestSorcerer(serverUrl, token, "POST", "/v1/jobs", body, {
      "Content-Type": "application/zip",
      "X-Sorcerer-Job-Type": jobType,
      "X-Sorcerer-Priority": String(Math.max(0, Math.min(100, Number(priority) || 50))),
      "X-Sorcerer-Metadata": JSON.stringify(metadata),
    });
    return JSON.parse(response.data.toString());
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});

ipcMain.handle("sorcerer-job", async (_event, { serverUrl, token, jobId }) => {
  const response = await requestSorcerer(serverUrl, token, "GET", `/v1/jobs/${encodeURIComponent(jobId)}`);
  return JSON.parse(response.data.toString());
});

ipcMain.handle("sorcerer-jobs", async (_event, { serverUrl, token }) => {
  const response = await requestSorcerer(serverUrl, token, "GET", "/v1/jobs");
  return JSON.parse(response.data.toString());
});

ipcMain.handle("sorcerer-cancel", async (_event, { serverUrl, token, jobId }) => {
  const response = await requestSorcerer(serverUrl, token, "POST", `/v1/jobs/${encodeURIComponent(jobId)}/cancel`);
  return JSON.parse(response.data.toString());
});

ipcMain.handle("sorcerer-requeue", async (_event, { serverUrl, token, jobId }) => {
  const response = await requestSorcerer(serverUrl, token, "POST", `/v1/jobs/${encodeURIComponent(jobId)}/requeue`);
  return JSON.parse(response.data.toString());
});

ipcMain.handle("sorcerer-download", async (_event, { serverUrl, token, jobId, outputFolder }) => {
  const response = await requestSorcerer(serverUrl, token, "GET", `/v1/jobs/${encodeURIComponent(jobId)}/result`);
  await fsp.mkdir(outputFolder, { recursive: true });
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "magic-sorcerer-result-"));
  const archive = path.join(tempDir, "result.zip");
  try {
    await fsp.writeFile(archive, response.data);
    await runPowerShell("param($archive,$destination) Expand-Archive -LiteralPath $archive -DestinationPath $destination -Force", [archive, outputFolder]);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
  return { outputFolder };
});

// ── IPC: script runner ────────────────────────────────────────────────────────
//
// run-script spawns the Python process and streams JSON-line events back to
// the renderer via webContents.send("script-event", payload).
// The renderer sends "script-continue" or "script-abort" for confirm steps.
// On abort, we send SIGTERM so the script can clean up.

const activeProcs = new Map(); // runId → ChildProcess

function listProcessIds(imageName) {
  try {
    const output = execFileSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${imageName}`, "/FO", "CSV", "/NH"],
      { encoding: "utf-8", windowsHide: true }
    );
    return new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.match(/^"[^"]+","(\d+)"/))
        .filter(Boolean)
        .map((match) => Number(match[1]))
    );
  } catch {
    return new Set();
  }
}

function terminateProcessTree(pid) {
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } catch {}
}

function cleanupRunAcrobat(run) {
  if (!run.isPdfRemediation) return;
  for (const pid of listProcessIds("Acrobat.exe")) {
    if (!run.existingAcrobatPids.has(pid)) {
      writeLog("acrobat-cleanup", { runId: run.runId, pid });
      terminateProcessTree(pid);
    }
  }
}

function terminateRun(run) {
  try { run.proc.stdin.write("abort\n"); } catch {}
  terminateProcessTree(run.proc.pid);
  cleanupRunAcrobat(run);
}

ipcMain.handle("run-script", (event, { runId, scriptFile, args }) => {
  return new Promise((resolve) => {
    const python     = resolvePython();
    const scriptPath = path.join(resolveScriptsDir(), scriptFile);
    const cwd        = resolveScriptsDir();

    const controlDir = path.join(app.getPath("userData"), "run-controls");
    const stopFilePath = path.join(controlDir, `${runId}.stop`);
    fs.mkdirSync(controlDir, { recursive: true });
    if (fs.existsSync(stopFilePath)) fs.unlinkSync(stopFilePath);

    const isPdfRemediation = scriptFile === "remediate_pdf.py";
    const existingAcrobatPids = isPdfRemediation ? listProcessIds("Acrobat.exe") : new Set();
    const proc = spawn(python, [scriptPath, ...args], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, MAGIC_STOP_FILE: stopFilePath },
    });
    const run = { runId, proc, stopFilePath, isPdfRemediation, existingAcrobatPids };
    activeProcs.set(runId, run);
    writeLog("run-started", { runId, scriptFile, pid: proc.pid });

    let buf = "";

    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          payload = { type: "log", message: line };
        }
        payload.runId = runId;
        event.sender.send("script-event", payload);
      }
    });

    proc.stderr.on("data", (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) event.sender.send("script-event", { type: "log", message: msg, runId });
    });

    proc.on("close", (code, signal) => {
      cleanupRunAcrobat(run);
      activeProcs.delete(runId);
      if (fs.existsSync(stopFilePath)) fs.unlinkSync(stopFilePath);
      writeLog("run-closed", { runId, scriptFile, code, signal });
      if (!event.sender.isDestroyed()) {
        event.sender.send("script-event", { type: "process-exit", code, runId });
      }
      resolve({ code });
    });

    proc.on("error", (err) => {
      cleanupRunAcrobat(run);
      activeProcs.delete(runId);
      if (fs.existsSync(stopFilePath)) fs.unlinkSync(stopFilePath);
      writeLog("run-error", { runId, scriptFile, message: err.message });
      if (!event.sender.isDestroyed()) {
        event.sender.send("script-event", { type: "run_error", message: err.message, runId });
      }
      resolve({ code: -1 });
    });
  });
});

ipcMain.on("script-abort", (_event, { runId }) => {
  const run = activeProcs.get(runId);
  if (run) {
    terminateRun(run);
    activeProcs.delete(runId);
  }
});

ipcMain.on("script-stop-after-current", (_event, { runId }) => {
  const run = activeProcs.get(runId);
  if (run) fs.writeFileSync(run.stopFilePath, "stop\n", "utf-8");
});

ipcMain.on("script-continue", (_event, { runId }) => {
  const run = activeProcs.get(runId);
  if (run) {
    try { run.proc.stdin.write("continue\n"); } catch {}
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  writeLog("app-ready", { version: APP_VERSION, pid: process.pid });
  createWindow();
});

app.on("before-quit", () => {
  writeLog("before-quit", { activeRuns: activeProcs.size });
  for (const run of activeProcs.values()) terminateRun(run);
  activeProcs.clear();
});

app.on("child-process-gone", (_event, details) => {
  writeLog("electron-child-process-gone", {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
  });
});

app.on("quit", (_event, exitCode) => writeLog("app-quit", { exitCode }));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
