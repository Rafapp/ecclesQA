import config from "../../config.json";
import type { WandConfig } from "./types";

export const wandConfig = config as WandConfig;
export const DEFAULT_TIMEOUT_MS = wandConfig.timeouts.defaultMs;
export const POLL_INTERVAL_MS = wandConfig.timeouts.pollIntervalMs;
