# Project Fantasia Roadmap

This roadmap turns the May 22, 2026 UDOIT export into an implementation order for Wand. Counts describe findings, not unique pages or estimated engineering effort, so they are priority signals rather than delivery promises.

## Current Direction

Wand is the active production project. The near-term goal is a context-aware UDOIT and Canvas companion that helps reviewers inspect issues, open the matching Canvas content, highlight the target, and proceed through fixes without assuming direct cross-origin iframe DOM access.

File repair, desktop apps, and server-side batch systems are outside the current production scope. Historical Magic and Sorcerer source has been removed from the active tree and remains available through Git history if needed.

## What The Data Says

- Canvas has 72,333 active findings out of 73,293 observed statuses, or 98.7% active.
- Wand's current five remediation types represent 53,669 active findings, or 74.2% of the active Canvas backlog.
- The two largest Canvas findings, styled headings and nondescript links, represent 37,416 findings, or 51.7% of the active backlog.
- Files account for 43,875 findings: PDF 19,822, DOC 16,101, PPT 7,603, and XLS 349.
- File remediation remains deferred from Wand because it requires a different review, backup, and validation workflow.

## Product Boundary

| Application | Status | Boundary |
| --- | --- | --- |
| Wand | Active production | Interactive UDOIT and Canvas inspection/remediation support |
| File repair tools | Deferred | Revisit later as a separately scoped product if needed |
| Batch automation tools | Deferred | Revisit only after single-reviewer workflows prove safe |

## Wand Roadmap

| Priority | Capability | Evidence | Status | Exit criteria |
| :-: | --- | --- | :-: | --- |
| P0 | Styled-heading remediation | 19,889 findings / 474 courses | In testing | Correct Canvas item opens, target is selected, save/next remains synchronized |
| P0 | Nondescript-link cleanup | 17,527 / 495 | In testing | Safe suggestion is applied without auto-saving; unsupported text fails visibly |
| P0 | Color-only identification and optional bold cue | 7,308 / 234 | In testing | Correct content is selected; reviewer explicitly applies and saves any cue |
| P0 | Filename-based image alternative-text cleanup | 5,070 / 298 | In testing | Filename cleanup is suggested with visible confirmation and no automatic save |
| P0 | Automatically generated caption review | 3,875 / 245 | In testing | Correct media opens; platform and UDOIT recheck actions work or fail visibly |
| P0 | Cross-workflow hardening | Protects all current modes | In progress | Test-course regression passes; loading, timeout, toast, logging, reload, and next-issue behavior are reliable |
| P1 | Table header rows and columns | 3,567 / 276 | In testing | Identify the table and provide safe header guidance or an explicit reviewed edit |
| P1 | Missing headings and skipped heading levels | 4,035 combined; up to 377 courses | In testing | Identify the location and guide a valid heading hierarchy without guessing structure |
| P1 | Links with no text | 1,954 / 304 | In testing | Identify the link and require descriptive text before resolution |
| P2 | Insufficient color contrast | 1,562 / 127 | In testing | Report measured colors and suggest a compliant branded alternative for review |
| P2 | Missing video captions | 1,044 / 164 | In testing | Open the correct media workflow and verify refreshed UDOIT status |
| P2 | Image alternative-text review | Test-course coverage | In testing | Identify generic, lengthy, missing, decorative, duplicated, and linked-image text cases without inventing descriptions |
| P2 | Transcript, readability, and document metadata review | Test-course coverage | In testing | Open the correct source and provide issue-specific reviewer guidance without claiming an automatic repair |
| P2 | Styled tabular data and empty-table review | Test-course coverage | In testing | Identify the relevant content and guide semantic table decisions without guessing structure |
| P2 | External-content review | Production backlog | Planned | Prioritize reliable identification and guidance; do not claim third-party content was repaired |
| Deferred | PDF, DOC, PPT, and XLS repair inside Wand | 43,875 file findings | Deferred | Remains outside the extension |

## Feature Ideas

- Add first-class bug and suggestion reporting inside the extension, with a reviewer-approved diagnostic bundle that can include the active issue type, source title, Wand version, recent action trail, DOM-safe page state, and optional screenshots.
- Add keyboard support for high-frequency review flows, including a reviewer-configurable next shortcut such as `n` for mark/save/advance once the reviewer has confirmed the current issue is ready.
- Add a release checklist that maps GitHub release assets to tested UDOIT issue families so version support is visible without reading commit history.

## Delivery Order

1. Finish Wand P0 field validation on Rafael's Test Course and release the five current remediations.
2. Add Wand P1 Canvas remediations in order of reach and safe automation potential.
3. Harden release packaging around Git tags and GitHub releases.
4. Re-run the analytics export after each release cycle and revise priorities when issue counts or completion rates materially change.
