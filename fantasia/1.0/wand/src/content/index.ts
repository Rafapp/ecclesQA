import { initializeHandlers } from "./handlers";
import { createPanel } from "./panel";
import { wandConfig } from "../shared/config";

initializeHandlers();

if (wandConfig.features.panel) {
  createPanel();
}
