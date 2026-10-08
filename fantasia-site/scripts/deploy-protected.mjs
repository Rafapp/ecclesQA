import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const workerName = "fantasia-site";
const wranglerCli = join("node_modules", "wrangler", "bin", "wrangler.js");
const secretsFile = process.env.FANTASIA_SECRETS_FILE;

if (!secretsFile || !existsSync(secretsFile)) {
  throw new Error("Set FANTASIA_SECRETS_FILE to an ignored .env file containing the existing production secret values before deploying.");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", env: options.env ?? process.env, shell: process.platform === "win32" && command.endsWith(".cmd") });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}: ${(result.stdout ?? "") + (result.stderr ?? "")}`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function runWrangler(args, options) {
  return run(process.execPath, [wranglerCli, ...args], options);
}

function activeVersion() {
  const output = runWrangler(["deployments", "list", "--name", workerName], { capture: true });
  const matches = [...output.matchAll(/\(100%\)\s+([0-9a-f-]{36})/gi)];
  const current = matches.at(-1)?.[1];
  if (!current) throw new Error("Could not identify the active Worker version before deployment.");
  return current;
}

async function waitForLocalSite(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`local site returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError ?? new Error("Local site did not start.");
}

async function availableLoopbackPort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function stopLocalServer(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill();
  }
}

const previousVersion = activeVersion();
let server;
let deployedVersion;
try {
  run(npm, ["run", "build"]);
  const port = await availableLoopbackPort();
  const localUrl = `http://127.0.0.1:${port}`;
  server = spawn(npm, ["run", "start", "--", "--port", String(port)], { cwd: process.cwd(), stdio: "inherit", shell: process.platform === "win32" });
  await waitForLocalSite(`${localUrl}/magic`);
  run(process.execPath, ["scripts/export-pages.mjs", "--output", "worker-assets"], { capture: false, env: { ...process.env, SITE_EXPORT_URL: localUrl } });
  const upload = runWrangler(["versions", "upload", "--config", "worker/wrangler.jsonc", "--keep-vars", "--secrets-file", secretsFile], { capture: true });
  process.stdout.write(upload);
  deployedVersion = upload.match(/Version ID:\s*([0-9a-f-]{36})/i)?.[1];
  if (!deployedVersion) throw new Error("Cloudflare did not report the uploaded Worker version.");
  const bindings = runWrangler(["versions", "view", deployedVersion, "--name", workerName], { capture: true });
  if (!bindings.includes("Secret Name:  SITE_PASSWORD") || !bindings.includes("Secret Name:  SESSION_SECRET")) {
    throw new Error("The deployed Worker is missing one or more password-gate secrets.");
  }
  runWrangler(["versions", "deploy", deployedVersion, "--name", workerName, "--yes"]);
  run(process.execPath, ["scripts/verify-production.mjs"]);
  console.log(`Protected deployment verified: ${deployedVersion}`);
} catch (error) {
  console.error(`Protected deployment failed: ${error.message}`);
  if (!deployedVersion) {
    console.error("No Worker version was deployed; the live site was not changed.");
    process.exitCode = 1;
  } else {
    try {
    runWrangler(["rollback", previousVersion, "--name", workerName, "--yes"]);
    run(process.execPath, ["scripts/verify-production.mjs"]);
    console.error(`Rolled back to healthy Worker version ${previousVersion}.`);
  } catch (rollbackError) {
    console.error(`Automatic rollback also failed: ${rollbackError.message}`);
  }
  }
  process.exitCode = 1;
} finally {
  stopLocalServer(server);
}
