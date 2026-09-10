import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import process from "node:process";

const options = parseOptions(process.argv.slice(2));
const basePath = (options.basePath ?? "").replace(/\/$/, "");
const sourceUrl = process.env.SITE_EXPORT_URL ?? "http://127.0.0.1:3000";
const outputDirectory = new URL(`../${options.outputDirectory ?? "pages-dist"}/`, import.meta.url);
const clientDirectory = new URL("../dist/client/", import.meta.url);
const routes = ["/wand", "/magic", "/sorcerer"];

await waitForSite(`${sourceUrl}/wand`);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(clientDirectory, outputDirectory, { recursive: true });

for (const route of routes) {
  const response = await fetch(`${sourceUrl}${route}`);
  if (!response.ok) throw new Error(`${route} returned ${response.status}.`);
  const output = new URL(`.${route}/index.html`, outputDirectory);
  await mkdir(new URL(`.${route}/`, outputDirectory), { recursive: true });
  await writeFile(output, rewriteAssetUrls(await response.text(), basePath));
}

const wandHtml = await fetch(`${sourceUrl}/wand`).then((response) => response.text());
await writeFile(new URL("index.html", outputDirectory), rewriteAssetUrls(wandHtml, basePath));
await writeFile(new URL(".nojekyll", outputDirectory), "");

function rewriteAssetUrls(html, path) {
  if (!path) return html;
  return html.replace(/\b(src|href)="\/(?!\/|#)/g, `$1="${path}/`);
}

function parseOptions(args) {
  const outputIndex = args.indexOf("--output");
  return {
    basePath: args.find((value) => value.startsWith("/")),
    outputDirectory: outputIndex >= 0 ? args[outputIndex + 1] : undefined,
  };
}

async function waitForSite(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Site returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError ?? new Error("Site did not become ready.");
}
