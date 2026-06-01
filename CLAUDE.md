# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` (repo root) holds the project conventions, structure overview, and security/PR guidelines. Read it too — this file focuses on the parts of the architecture that require reading several files to understand. Where they overlap, AGENTS.md is authoritative on style and process.

## Active project

`fantasia/1.0/wand` is the active codebase: a Manifest V3 Chrome extension for UDOIT/Canvas accessibility automation. Run all commands from that directory.

`fantasia/0.0/Accessibility` is an earlier generation of Python modules (docx/pdf/pptx/xlsx accessibility scanners, analytics scripts) plus Tampermonkey helpers. `tampermonkey/udoit.js` is the behavioral reference when porting old automation into the extension. These are script-oriented with no shared build.

## Commands (run from `fantasia/1.0/wand`)

```bash
npm install
npm run dev        # full dev: Vite watch build + local SSE reload server on 127.0.0.1:5174
npm run dev:watch  # watch build only, no reload server
npm run build      # production build into dist/
npm run typecheck  # tsc --noEmit, strict
```

There is no test framework. Before handing off extension changes, run `npm run typecheck` and `npm run build`.

To load the extension: build, then load `fantasia/1.0/wand/dist` as an unpacked extension in `chrome://extensions` (Developer mode on).

## Build pipeline

Vite (`vite.config.ts`) builds two entry points — `src/content/index.ts` → `dist/content.js` and `src/background/index.ts` → `dist/background.js` — as ES modules with fixed names (no hashing, because the manifest references them by name). `public/` is copied verbatim into `dist/`; it holds the manifest, icons, and `windowOpenCapture.js` (see remediation flow below). `mode === "development"` disables minify and enables sourcemaps. The `dist/` directory is build output and rebuildable; do not hand-edit it.

`config.json` is imported directly into the bundle via `resolveJsonModule` (see `src/shared/config.ts`) — it is compile-time config, not runtime-loaded, so a config change requires a rebuild.

## Frame model (the core constraint)

The content script runs in **every frame** of UDOIT and Canvas pages (`all_frames: true`). UDOIT (`udoit3.ciditools.com`) and Canvas (`*.instructure.com`) are cross-origin, so frames cannot read each other's DOM or call each other directly. Almost every design choice flows from this. Two coordination channels exist:

- **`window.postMessage` between frames** — `frameBridge.ts` is the single place this happens. It defines every message type (`page-snapshot`, `frame-command`, `canvas-saved`, `workspace-url`) with paired `post…`/`listenFor…` helpers and validating type guards. Child frames post upward to `window.parent`; the top frame fans commands out to `window.frames`. Anything crossing a frame boundary must go through here, not ad-hoc `postMessage`.
- **`chrome.storage.local` + the background worker** — used when coordination must survive a navigation or tab swap (pending remediation, pending advance, dev-reload). Keys live in `src/shared/remediation.ts`.

`content/index.ts` branches on frame position: the **top frame** renders the panel + workspace and aggregates snapshots; **child frames** run the detector, post snapshots up, and execute remediation/advance commands. Read this file first — it is the orchestrator that ties detector, panel, workspace, and remediator together.

## Detection: `udoitDetector.ts`

A debounced `MutationObserver` builds a `PageSnapshot` (the contract in `src/shared/types.ts`) and emits it only when a signature changes. It is entirely heuristic and DOM-text-driven; tuning means editing the regex/selector constants at the top of the file. It produces:

- `pageKind` from hostname (`udoit` / `canvas` / `unknown`).
- `issueCount` via an ordered fallback chain: scorecard table totals → loose role=row scorecard rows → counter/pagination text regexes → empty-state detection → visible row count.
- `udoitView` (`scorecard` / `issueList` / `fixModal` / `unknown`) — derived from page structure and whether a remediation modal is open.
- `remediation` (a `RemediationContext`) — only populated when a UFIXIT modal is open **and** its issue type is in `SUPPORTED_REMEDIATIONS` (`shared/remediation.ts`). This is the gate for the whole automation: an unsupported issue type yields no remediation context, so the panel button never appears.

`PageSnapshot` is the shared contract across detector, `frameBridge` (its validator), and `panel`; changing its shape ripples through all three.

## Remediation workflow (the main feature)

This is the non-obvious, multi-file flow. A user on a supported UDOIT fix modal clicks the panel button, and the extension drives an end-to-end fix across both origins:

1. **Trigger** — top-frame panel button posts a `start-remediation` command; the UDOIT child frame with a live `remediation` snapshot runs `startUdoitRemediation` (`udoitRemediator.ts`).
2. **Capture the Canvas URL** — UDOIT opens its "Found in" source via `window.open`, which content scripts can't intercept directly. `udoitRemediator` injects `public/windowOpenCapture.js` into the **page's** JS context (it is a `web_accessible_resource`); that shim monkey-patches `window.open`, captures the `*.instructure.com` URL, cancels the popup, and posts it back. The remediation context is also stashed in `chrome.storage.local`.
3. **Open the workspace** — the captured URL is posted to the top frame, which `workspace.ts` loads in an in-page iframe overlay (`#wand-workspace`) instead of a new tab. `background/workspace.ts` is a fallback router: if a real Canvas tab is opened by the source tab within a time window, it redirects that URL into the workspace iframe and closes the stray tab.
4. **Locate the target in Canvas** — `canvasHighlighter.ts` runs in the Canvas frame, reads the pending remediation from storage, enters edit mode if needed, and finds/highlights/centers the offending text. This is the largest and most defensive module: it walks nested TinyMCE editor iframes, selects text via `window.find` with a DOM-range fallback, centers the selection, and a watcher re-centers until the user starts editing (then it backs off).
5. **Advance** — when Canvas saves, a `canvas-saved` message flows up; the top frame sets an "advance pending" storage flag and broadcasts `advance-remediation`. The UDOIT frame consumes the flag, clicks "Next Issue", and auto-launches remediation for the next supported issue — looping until none remain.

To add support for a new UDOIT issue type, start by adding its exact label to `SUPPORTED_REMEDIATIONS`; then verify the detector extracts a usable `sourceTitle`/`previewText` from that modal and that the highlighter's matching heuristics find the text in Canvas.

## Dev reload mechanism (development mode only)

`npm run dev` starts `scripts/dev.mjs`: a Node SSE server on `127.0.0.1:5174` plus a Vite watch build. On each rebuild the server pushes a `reload` SSE event; `content/devReload.ts` (an `EventSource` in pages) relays it to `background/devReload.ts`, which sets a `chrome.storage.local` pending flag, calls `chrome.runtime.reload()`, and on next startup reloads the matching UDOIT/Canvas tabs. All of this is gated on `import.meta.env.MODE === "development"` and stripped from production builds. The manifest's `http://127.0.0.1:5174/*` host permission exists only for this SSE connection.

## Conventions specific to this code

- TypeScript strict mode, ES modules, two-space indent, double quotes, semicolons. No code comments unless asked (per AGENTS.md).
- Code is decomposed into small verb-led helpers (`getPageSnapshot`, `isVisible`, `selectTextInReadyEditor`, `normalize`). Follow that decomposition rather than adding large multi-purpose functions.
- Detection and highlighting are inherently brittle against UDOIT/Canvas DOM changes — prefer text-pattern and role-based matching with fallbacks over fixed CSS paths, which is the existing style.
- Anything crossing a frame boundary goes through `frameBridge.ts`; anything that must survive a navigation goes through `chrome.storage.local` with keys from `shared/remediation.ts`.