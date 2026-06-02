const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
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
  const win = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 720,
    minHeight: 480,
    title: `Magic v${APP_VERSION}`,
    icon: path.join(__dirname, "..", "icons", "256.png"),
    backgroundColor: "#0f1117",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
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

ipcMain.handle("run-script", (event, { runId, scriptFile, args }) => {
  return new Promise((resolve) => {
    const python     = resolvePython();
    const scriptsDir = resolveScriptsDir();
    const scriptPath = path.join(scriptsDir, scriptFile);

    const pythonExists = fs.existsSync(python);
    const scriptExists = fs.existsSync(scriptPath);

    if (!pythonExists || !scriptExists) {
      const msg = [
        "Launch failed — one or more required files were not found.",
        `  python : ${python} — ${pythonExists ? "OK" : "NOT FOUND"}`,
        `  script : ${scriptPath} — ${scriptExists ? "OK" : "NOT FOUND"}`,
        `  resourcesPath: ${process.resourcesPath}`,
        `  isPackaged: ${app.isPackaged}`,
      ].join("\n");
      event.sender.send("script-event", { type: "run_error", message: msg, runId });
      resolve({ code: -1 });
      return;
    }

    const cwd = scriptsDir;
    const proc = spawn(python, [scriptPath, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    activeProcs.set(runId, proc);

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
      event.sender.send("script-event", { type: "process-exit", code, runId });
      resolve({ code });
    });

    proc.on("error", (err) => {
      activeProcs.delete(runId);
      const msg = [
        `Failed to start Python process: ${err.message}`,
        `  python : ${python}`,
        `  script : ${scriptPath}`,
        `  resourcesPath: ${process.resourcesPath}`,
        `  isPackaged: ${app.isPackaged}`,
      ].join("\n");
      event.sender.send("script-event", { type: "run_error", message: msg, runId });
      resolve({ code: -1 });
    });
  });
});

ipcMain.on("script-abort", (_event, { runId }) => {
  const proc = activeProcs.get(runId);
  if (proc) {
    try { proc.stdin.write("abort\n"); } catch {}
    proc.kill("SIGTERM");
    activeProcs.delete(runId);
  }
});

ipcMain.on("script-continue", (_event, { runId }) => {
  const proc = activeProcs.get(runId);
  if (proc) {
    try { proc.stdin.write("continue\n"); } catch {}
  }
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
