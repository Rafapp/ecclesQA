export type WandConfig = {
  retryCount: number;
  timeouts: {
    defaultMs: number;
    pollIntervalMs: number;
  };
  features: {
    panel: boolean;
    debugLogging: boolean;
  };
};
