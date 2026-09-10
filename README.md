# Project Fantasia

Issue inspection and automation tools for the Eccles School of Business Instructional Design team.

The shared installation site lives in `fantasia-site`. It presents release status and setup guidance for Wand and Magic and is designed to add Sorcerer without restructuring the site.

## Active Project

`fantasia/wand` is the active production project. Wand is a Manifest V3 Chrome extension for UDOIT and Canvas. Its current goal is to help reviewers inspect supported UDOIT findings, open the matching Canvas content, highlight the target, and move through the remediation workflow with clear reviewer control.

Retired experiments and historical versions are kept in Git history, tags, and GitHub releases instead of source-tree snapshots.

## Wand

Current package version: `1.1.0`

### Install From A Release

1. Go to the [Releases page](../../releases).
2. Download the latest `wand-extension-*.zip` asset.
3. Unzip it locally.
4. Open `chrome://extensions` in Chrome.
5. Turn on Developer mode.
6. Click Load unpacked and choose the unzipped extension folder.

The Fantasia installation site provides the same steps in a team-friendly format, including current Magic screenshots.

### Use

1. Open a course in UDOIT and run a scan.
2. Open a supported issue.
3. Use the Wand bar at the bottom of the page to open the matching Canvas content.
4. Review the highlighted target and apply the fix in Canvas.

Wand runs only on UDOIT and Canvas pages declared in the extension manifest.

Bug reports and suggestions can be created from the Chrome toolbar popup or the bottom Wand panel. Drafts are saved locally, optionally include recent Wand diagnostics, and can be copied or exported until a central team endpoint is approved.

## Development

Run commands from `fantasia/wand`:

```bash
npm install
npm run dev
npm run dev:watch
npm run typecheck
npm run build
```

`npm run dev` starts the Vite watch build and local reload signal. `npm run dev:watch` runs watch builds only. `npm run typecheck` runs strict no-emit TypeScript. `npm run build` emits `dist`.

Before handing off extension changes, run:

```bash
npm run typecheck
npm run build
```

## Version Management

Every push or pull request that changes Wand is validated by GitHub Actions. Tags publish distributable versions automatically:

1. Update `fantasia/wand/package.json`.
2. Run validation from `fantasia/wand`.
3. Commit and push the version change.
4. Create and push the matching tag, such as `wand-v1.1.0`.
5. GitHub validates the tag, builds the extension, and publishes `wand-extension-v1.1.0.zip` on the Releases page.

The tag must exactly match the version in `fantasia/wand/package.json`. Run `npm run package` only when you need a local ZIP for testing.

Do not keep old production versions as copied folders in the repo. Recreate them from Git tags or release assets when needed.

## Reference Archive

`deprecated/Accessibility/tampermonkey/udoit.js` is retained as a reference for earlier UDOIT automation behavior. Older Python modules, analytics output, copied version folders, and retired product experiments are removed from the active tree.

## Current Capability Status

<!-- WAND_CAPABILITIES:START -->

Current package version: `1.1.0`

| Capability | Status |
| --- | --- |
| Open the matching Canvas source | Available |
| Styled heading remediation | Validated |
| Nondescript link cleanup | Validated |
| Color-only communication review | Validated |
| Filename-based image alternative text | Validated |
| Video caption review | Validated |
| Heading, table, list, link, and image guidance | In testing |
| Progress, diagnostics, and feedback drafts | Available |

<!-- WAND_CAPABILITIES:END -->

The website and this table are generated from the same product catalog. See [the support matrix](fantasia/wand/SUPPORT.md) and [live validation matrix](fantasia/wand/LIVE_VALIDATION.md) for deeper workflow detail.
