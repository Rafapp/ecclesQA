import http from "node:http";
import process from "node:process";
import { build } from "vite";

const DEV_RELOAD_PORT = 5174;
const clients = new Set();
let rollupWatchers = [];
let serverStarted = false;
let shuttingDown = false;

const server = http.createServer((request, response) => {
  const baseUrl = `http://${request.headers.host ?? "127.0.0.1"}`;
  const url = new URL(request.url ?? "/", baseUrl);

  if (request.method === "OPTIONS") {
    response.writeHead(204, getHeaders());
    response.end();
    return;
  }

  if (url.pathname === "/events") {
    response.writeHead(200, getHeaders({
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    }));
    response.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  if (url.pathname === "/health") {
    response.writeHead(200, getHeaders({ "Content-Type": "application/json" }));
    response.end(JSON.stringify({ ok: true, clients: clients.size }));
    return;
  }

  response.writeHead(404, getHeaders({ "Content-Type": "text/plain" }));
  response.end("Not found");
});

server.on("error", (error) => {
  console.error(`[wand] Dev reload server failed: ${error.message}`);
  shutdown(1);
});

server.listen(DEV_RELOAD_PORT, "127.0.0.1", () => {
  serverStarted = true;
  console.log(`[wand] Dev reload server listening at http://127.0.0.1:${DEV_RELOAD_PORT}/events`);
});

try {
  const watcher = await build({
    mode: "development",
    clearScreen: false,
    build: {
      watch: {},
    },
  });

  rollupWatchers = Array.isArray(watcher) ? watcher : [watcher];

  for (const rollupWatcher of rollupWatchers) {
    rollupWatcher.on("event", (event) => {
      if (event.code === "START") {
        console.log("[wand] Building extension...");
      }

      if (event.code === "BUNDLE_END") {
        sendReload("bundle");
      }

      if (event.code === "ERROR") {
        console.error("[wand] Build failed:", event.error);
      }

      if (event.code === "END") {
        console.log("[wand] Watching for changes...");
      }
    });
  }
} catch (error) {
  console.error("[wand] Failed to start dev watcher:", error);
  shutdown(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function getHeaders(extraHeaders = {}) {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  };
}

function sendReload(reason) {
  const data = JSON.stringify({ reason, at: new Date().toISOString() });

  for (const client of clients) {
    client.write(`event: reload\ndata: ${data}\n\n`);
  }

  console.log(`[wand] Reload signal sent to ${clients.size} page(s).`);
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const rollupWatcher of rollupWatchers) {
    rollupWatcher.close();
  }

  if (!serverStarted) {
    process.exit(exitCode);
  }

  server.close(() => {
    process.exit(exitCode);
  });
}
