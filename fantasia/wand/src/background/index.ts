import { initializeBackgroundDevReload } from "./devReload";
import { initializeWorkspaceRouting } from "./workspace";

initializeBackgroundDevReload();
initializeWorkspaceRouting();

chrome.runtime.onInstalled.addListener(() => {
});
