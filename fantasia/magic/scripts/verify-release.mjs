import { readFileSync } from "fs";
import https from "https";
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

if (process.argv.includes("--online")) {
  const statusCode = await requestStatus(expectedUrl);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Magic release asset check received HTTP ${statusCode}: ${expectedUrl}`);
  }
  console.log("Magic release asset is reachable.");
}

function requestStatus(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "Fantasia Magic release verification" } }, (response) => {
      response.resume();
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirectsLeft > 0) {
        resolve(requestStatus(new URL(response.headers.location, url), redirectsLeft - 1));
        return;
      }
      resolve(response.statusCode ?? 0);
    });
    request.setTimeout(15_000, () => request.destroy(new Error("request timed out")));
    request.on("error", reject);
  });
}
