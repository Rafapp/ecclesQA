# Repository Guidelines

## Architecture & Current Direction

`wand` is the active project: a Manifest V3 Chrome extension for UDOIT and Canvas automation. The current direction is a context-aware UDOIT/Canvas companion. Phase 1 should help users inspect UDOIT issues in Canvas. Avoid future `magic` or `sorcerer` work unless requested.

When designing around UDOIT iframes, account for cross-origin limits between `udoit3.ciditools.com` and `*.instructure.com`. Prefer content scripts, messaging, tabs/windows, or Chrome APIs over direct iframe DOM assumptions.

## Project Structure & Module Organization

`fantasia/1.0/wand` is the current Chrome extension. Source lives in `src`: `src/content` holds UI and handlers, `src/background` holds the service worker, and `src/shared` contains config, types, and utilities. Static assets live in `public`; build output goes to `dist`.

`fantasia/0.0/Accessibility` contains earlier Python modules, analytics scripts, and Tampermonkey helpers. Use `tampermonkey/udoit.js` as behavioral reference when porting existing automation.

## Build, Test, and Development Commands

Run extension commands from `fantasia/1.0/wand`:

```bash
npm install
npm run dev
npm run dev:watch
npm run typecheck
npm run build
```

`npm run dev` starts Vite watch plus the local reload signal. `npm run dev:watch` runs watch builds only. `npm run typecheck` runs strict no-emit TypeScript. `npm run build` emits `dist`.

Python modules are script-oriented; run entry points from `fantasia/0.0`.

## Coding Style & Naming Conventions

TypeScript uses ES modules, strict typing, two-space indentation, double quotes, and semicolons. Prefer small named functions and shared helpers in `src/shared`.

Follow existing naming patterns: camelCase variables/functions, SCREAMING_SNAKE_CASE constants for global/static values, and verb-led helpers such as `getIssueTarget`, `isVisible`, or `normalize`. Do not add code comments unless requested.

## Testing Guidelines

No automated test framework is configured. For extension changes, run `npm run typecheck` and `npm run build` before handing off. If adding tests, use names like `*.test.ts` or `test_*.py`.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries such as `Add tampermonkey scripts` and `Update link auto fixer`. Keep commits focused. Pull requests should include a description, validation steps, task context, and screenshots for UI changes.

## Agent-Specific Instructions

Before substantial implementation, describe options and tradeoffs, then recommend one. Ask when ambiguity affects architecture, permissions, data flow, or UX. Preserve current style over generic preferences.

## Security & Configuration Tips

Do not commit real secrets. Keep credentials under `.secrets`, and commit only example environment files. Treat generated `dist`, reports, and local output as rebuildable unless a task explicitly requires preserving them.
