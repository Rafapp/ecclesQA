# Project Fantasia

Issue inspection and automation tools for the Eccles School of Business Instructional Design team.

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

### Use

1. Open a course in UDOIT and run a scan.
2. Open a supported issue.
3. Use the Wand bar at the bottom of the page to open the matching Canvas content.
4. Review the highlighted target and apply the fix in Canvas.

Wand runs only on UDOIT and Canvas pages declared in the extension manifest.

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

Use GitHub releases for distributable versions:

1. Update `fantasia/wand/package.json`.
2. Run validation from `fantasia/wand`.
3. Run `npm run package` to create a release zip under `downloads`.
4. Create a Git tag such as `wand-v1.1.0`.
5. Attach the zip to the matching GitHub release.

Do not keep old production versions as copied folders in the repo. Recreate them from Git tags or release assets when needed.

## Reference Archive

`deprecated/Accessibility/tampermonkey/udoit.js` is retained as a reference for earlier UDOIT automation behavior. Older Python modules, analytics output, copied version folders, and retired product experiments are removed from the active tree.

## Current Milestone

Wand's assisted remediation remains focused on five high-volume UDOIT issue families documented in [ROADMAP.md](ROADMAP.md):

- Styles might be used instead of semantic markup for structure.
- Link has nondescript text.
- Potential use of color alone to communicate information.
- Alternative text uses filename rather than a descriptive label.
- Video captions appear to be automatically generated and may contain errors.

Wand now recognizes all 27 non-file issue names in the current Rafael's Test Course export, plus list-formatting and layout-table modes retained for broader coverage. Subjective corrections use reviewer-guided Canvas workflows. See [the support matrix](fantasia/wand/SUPPORT.md).
