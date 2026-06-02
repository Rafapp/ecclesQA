const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("magic", {
  getVersion:  () => ipcRenderer.invoke("get-version"),
  getScripts:  () => ipcRenderer.invoke("get-scripts"),
  pickFolder:  () => ipcRenderer.invoke("pick-folder"),
  openFolder:  (folderPath) => ipcRenderer.invoke("open-folder", folderPath),
  getPrefs:    () => ipcRenderer.invoke("get-prefs"),
  setPref:     (key, value) => ipcRenderer.invoke("set-pref", { key, value }),

  runScript: (runId, scriptFile, args) =>
    ipcRenderer.invoke("run-script", { runId, scriptFile, args }),

  abortScript:    (runId) => ipcRenderer.send("script-abort",    { runId }),
  continueScript: (runId) => ipcRenderer.send("script-continue", { runId }),

  onScriptEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("script-event", handler);
    return () => ipcRenderer.removeListener("script-event", handler);
  },
});
