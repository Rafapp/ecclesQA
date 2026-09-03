import { createRequire } from "module";
import { fileURLToPath } from "url";
import { join } from "path";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = createRequire(import.meta.url)(join(root, "package.json"));
const expectedTag = `wand-v${pkg.version}`;
const actualTag = process.env.GITHUB_REF_NAME || process.argv[2];

if (actualTag !== expectedTag) {
  console.error(`Release tag must be ${expectedTag}; received ${actualTag || "no tag"}.`);
  process.exit(1);
}

console.log(`Release tag ${actualTag} matches Wand ${pkg.version}.`);
