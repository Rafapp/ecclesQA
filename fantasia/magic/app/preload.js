const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("magic", {
  getVersion: () => ipcRenderer.invoke("get-version"),
  getScripts: () => ipcRenderer.invoke("get-scripts"),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  runScript: (scriptFile, workingDir) =>
    ipcRenderer.invoke("run-script", { scriptFile, workingDir }),
});
