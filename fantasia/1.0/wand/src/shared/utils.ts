export function normalize(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
