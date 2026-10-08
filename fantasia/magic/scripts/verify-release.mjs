import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const magicRoot = join(scriptsDir, "..");
const repoRoot = join(magicRoot, "..", "..");
const packageJson = JSON.parse(readFileSync(join(magicRoot, "package.json"), "utf8"));
const catalog = JSON.parse(readFileSync(join(repoRoot, "fantasia-site", "content", "products.json"), "utf8"));
const magic = catalog.products.find((product) => product.id === "magic");

if (!magic) {
  throw new Error("The site product catalog has no Magic entry.");
}

const version = packageJson.version;
const expectedTag = `magic-v${version}`;
const expectedAsset = `magic-application-v${version}.zip`;
const expectedUrl = `https://github.com/Rafapp/ecclesQA/releases/download/${expectedTag}/${expectedAsset}`;

if (magic.version !== version) {
  throw new Error(`Magic version mismatch: package.json is ${version}, but the site catalog is ${magic.version ?? "unset"}.`);
}

if (magic.downloadUrl !== expectedUrl) {
  throw new Error(`Magic download URL must be ${expectedUrl}.`);
}

console.log(`Magic release metadata is aligned for ${expectedTag}: ${expectedAsset}`);
