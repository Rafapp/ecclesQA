import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import process from "node:process";

const basePath = (process.argv[2] ?? "").replace(/\/$/, "");
const sourceUrl = process.env.SITE_EXPORT_URL ?? "http://127.0.0.1:3000/";
const outputDirectory = new URL("../pages-dist/", import.meta.url);
const clientDirectory = new URL("../dist/client/", import.meta.url);

const response = await waitForSite(sourceUrl);
let html = await response.text();
if (basePath) {
  html = html.replace(/\b(src|href)="\/(?!\/|#)/g, `$1="${basePath}/`);
  html = html.replaceAll('"/_next/', `"${basePath}/_next/`);
  html = html.replaceAll('"/products/', `"${basePath}/products/`);
  html = html.replaceAll('"/screenshots/', `"${basePath}/screenshots/`);
  html = html.replaceAll('"/favicon.png', `"${basePath}/favicon.png`);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(clientDirectory, outputDirectory, { recursive: true });
await writeFile(new URL("index.html", outputDirectory), html);
await writeFile(new URL(".nojekyll", outputDirectory), "");

async function waitForSite(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const result = await fetch(url);
      if (result.ok) return result;
      lastError = new Error(`Site returned ${result.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError ?? new Error("Site did not become ready.");
}
