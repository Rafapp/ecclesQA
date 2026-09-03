# Codebase Status

Last initialized: 2026-09-03

## Production Direction

`fantasia/wand` is the production codebase. It is a Manifest V3 Chrome extension for UDOIT and Canvas automation, focused on helping reviewers inspect UDOIT issues and open the matching Canvas content for remediation.

Version snapshots and retired product experiments do not belong in the source tree. Use Git history, tags, GitHub releases, and release assets for version management instead of directories such as `fantasia/0.0` or `fantasia/1.0`.

## Active Layout

- `fantasia/wand/src/content`: content-script UI, UDOIT detection, Canvas highlighting, remediation handlers, frame messaging, and workspace behavior.
- `fantasia/wand/src/background`: service worker modules for reload, workspace tab routing, and media helpers.
- `fantasia/wand/src/shared`: shared config, types, remediation labels, and utilities.
- `fantasia/wand/src/shared/diagnostics.ts`: bounded local diagnostic log for broken automation reports.
- `fantasia/wand/public`: manifest, static popup assets, icons, and page-context shims copied into `dist`.
- `fantasia/wand/tests`: Node test coverage for shared remediation helpers.
- `deprecated/Accessibility/tampermonkey/udoit.js`: retained reference script for earlier UDOIT automation behavior.

## Build And Validation

Run from `fantasia/wand`:

```bash
npm install
npm run typecheck
npm run build
```

`dist` is generated output and should not be committed. Release packages should be created from a fresh build and attached to GitHub releases.

## Cleanup Decisions

- Removed old source-tree version snapshots.
- Removed retired Magic and Sorcerer source from the active tree.
- Removed generated `fantasia/wand/dist` from version control.
- Removed local temp exports, scratch fixtures, and duplicate generated assets.
- Kept only `deprecated/Accessibility/tampermonkey/udoit.js` because current repo instructions identify it as a useful reference for future Wand ports.

## Current Automation Boundary

Wand may reduce clicks, open relevant Canvas/UDOIT surfaces, fill safe suggestions, and advance after an explicit reviewer action. It should not choose subjective content changes or silently save them.
