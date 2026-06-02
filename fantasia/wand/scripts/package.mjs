import { execSync } from "child_process";
import { mkdirSync, statSync } from "fs";
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

console.log("Building wand...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

mkdirSync(join(repoRoot, "downloads"), { recursive: true });

console.log(`\nZipping dist/ -> downloads/${zipName}...`);
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${destZip}' -Force"`,
  { stdio: "inherit" }
);

const mb = (statSync(destZip).size / 1024 / 1024).toFixed(1);
console.log(`Packaged: downloads/${zipName} (${mb} MB)`);
