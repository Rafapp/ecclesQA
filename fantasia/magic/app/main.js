const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const fs = require("fs");

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

function terminateRun(run) {
  try { run.proc.stdin.write("abort\n"); } catch {}
  terminateProcessTree(run.proc.pid);
  if (run.isPdfRemediation) {
    for (const pid of listProcessIds("Acrobat.exe")) {
      if (!run.existingAcrobatPids.has(pid)) terminateProcessTree(pid);
    }
  }
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
    activeProcs.set(runId, { proc, stopFilePath, isPdfRemediation, existingAcrobatPids });

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

    proc.on("close", (code) => {
      activeProcs.delete(runId);
      if (fs.existsSync(stopFilePath)) fs.unlinkSync(stopFilePath);
      event.sender.send("script-event", { type: "process-exit", code, runId });
      resolve({ code });
    });

    proc.on("error", (err) => {
      activeProcs.delete(runId);
      if (fs.existsSync(stopFilePath)) fs.unlinkSync(stopFilePath);
      event.sender.send("script-event", { type: "run_error", message: err.message, runId });
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

app.whenReady().then(createWindow);

app.on("before-quit", () => {
  for (const run of activeProcs.values()) terminateRun(run);
  activeProcs.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
