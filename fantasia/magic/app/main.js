const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

const APP_VERSION = app.getVersion();

function resolvePython() {
  // In packaged app, bundled python lives in resources/python/
  // In dev, fall back to system python
  const bundled = path.join(process.resourcesPath, "python", "python.exe");
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  return "python";
}

function resolveScriptsDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "scripts");
  }
  return path.join(__dirname, "..", "scripts");
}

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
}

ipcMain.handle("get-version", () => APP_VERSION);

ipcMain.handle("get-scripts", () => {
  const manifestPath = path.join(__dirname, "scripts-manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
});

ipcMain.handle("pick-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select folder to run script from",
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("run-script", (_event, { scriptFile, workingDir }) => {
  return new Promise((resolve) => {
    const python = resolvePython();
    const scriptPath = path.join(resolveScriptsDir(), scriptFile);
    const cwd = workingDir || resolveScriptsDir();

    const proc = spawn(python, [scriptPath], { cwd });
    let output = "";
    let error = "";

    proc.stdout.on("data", (d) => { output += d.toString(); });
    proc.stderr.on("data", (d) => { error += d.toString(); });

    proc.on("close", (code) => {
      resolve({ code, output, error });
    });

    proc.on("error", (err) => {
      resolve({ code: -1, output: "", error: err.message });
    });
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
