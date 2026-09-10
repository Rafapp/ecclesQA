import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const startMarker = "<!-- WAND_CAPABILITIES:START -->";
const endMarker = "<!-- WAND_CAPABILITIES:END -->";
const catalogUrl = new URL("../content/products.json", import.meta.url);
const readmeUrl = new URL("../../README.md", import.meta.url);

const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const readme = await readFile(readmeUrl, "utf8");
const wand = catalog.products.find((product) => product.id === "wand");
const rows = catalog.wandCapabilities
  .map((capability) => `| ${capability.name} | ${capability.statusLabel} |`)
  .join("\n");
const generated = `${startMarker}\n\nCurrent package version: \`${wand.version}\`\n\n| Capability | Status |\n| --- | --- |\n${rows}\n\n${endMarker}`;
const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`);

if (!pattern.test(readme)) {
  throw new Error("README capability markers are missing.");
}

const nextReadme = readme.replace(pattern, generated);
if (process.argv.includes("--check")) {
  if (nextReadme !== readme) {
    throw new Error("README capability status is stale. Run npm run docs:sync from fantasia-site.");
  }
} else {
  await writeFile(readmeUrl, nextReadme);
}
