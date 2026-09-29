import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptsDir, "..");
const python = join(root, "python", "python.exe");
const builder = join(root, "node_modules", "electron-builder", "cli.js");

if (process.platform !== "win32") {
  throw new Error("Magic portable builds must be created on Windows.");
}

if (!existsSync(python)) {
  throw new Error(
    "Bundled Python was not found at fantasia/magic/python/python.exe. " +
      "Add the Windows embeddable Python runtime before building so the executable works on devices without Python installed."
  );
}

if (!existsSync(builder)) {
  throw new Error("Node dependencies are missing. Run npm ci from fantasia/magic first.");
}

execFileSync(process.execPath, [builder, "--win", "portable"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});
