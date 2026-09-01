import { initializeExtensionReload } from "./reload";
import { initializeMediaPlatformRouting } from "./media";
import { initializeWorkspaceRouting } from "./workspace";

initializeExtensionReload();
initializeMediaPlatformRouting();
initializeWorkspaceRouting();

chrome.runtime.onInstalled.addListener(() => {
});
