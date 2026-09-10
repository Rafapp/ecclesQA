import { execFileSync, execSync } from "child_process";
import { copyFileSync, mkdirSync, rmSync, statSync } from "fs";
import { resolve, join } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname  = fileURLToPath(new URL(".", import.meta.url));
const root       = resolve(__dirname, "..");
const repoRoot   = resolve(root, "../..");
const pkg        = createRequire(import.meta.url)(join(root, "package.json"));

const distDir    = join(root, "dist");
const zipName    = `wand-extension-v${pkg.version}.zip`;
const destZip    = join(repoRoot, "downloads", zipName);
const latestZip  = join(repoRoot, "downloads", "wand-extension-latest.zip");

console.log("Building wand...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

mkdirSync(join(repoRoot, "downloads"), { recursive: true });
rmSync(destZip, { force: true });
rmSync(latestZip, { force: true });

console.log(`\nZipping dist/ -> downloads/${zipName}...`);
if (process.platform === "win32") {
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    "Compress-Archive",
    "-Path",
    `${distDir}\\*`,
    "-DestinationPath",
    destZip,
    "-Force",
  ], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", destZip, "."], { cwd: distDir, stdio: "inherit" });
}

copyFileSync(destZip, latestZip);

const mb = (statSync(destZip).size / 1024 / 1024).toFixed(1);
console.log(`Packaged: downloads/${zipName} (${mb} MB)`);
console.log("Latest alias: downloads/wand-extension-latest.zip");
