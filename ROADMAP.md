# Project Fantasia Roadmap

This roadmap turns the May 22, 2026 UDOIT export into an implementation order for Wand. Counts describe findings, not unique pages or estimated engineering effort, so they are priority signals rather than delivery promises.

## Current Direction

Wand is the active production project. The near-term goal is a context-aware UDOIT and Canvas companion that helps reviewers inspect issues, open the matching Canvas content, highlight the target, and proceed through fixes without assuming direct cross-origin iframe DOM access.

File repair and server-side batch work are now active as the Sorcerer delivery
track. Wand remains independently maintained.

## Sorcerer Progress

- 2026-09-29: Added the Sorcerer LAN server foundation: authenticated client
  tokens, persistent SQLite queue, priority scheduling, serialized workflow
  execution, cancellation/requeue, progress capture, result ZIP download, and
  a terminal status watcher. API and deployment documentation live in
  `fantasia/sorcerer/`.
- 2026-09-29: Added Magic's Sorcerer mode. It archives the selected source
  folder, submits it to the authenticated queue, polls workflow progress,
  supports cancellation, and extracts the completed result into the selected
  local output folder.
- 2026-09-29: Added a self-contained Sorcerer integration test for
  authentication, queue submission, worker execution, and result delivery.
- 2026-09-29: Hardened worker shutdown and test cleanup for Windows file-lock
  behavior by joining the worker and closing subprocess output handles.
- 2026-09-29: Fixed Sorcerer's SQLite lifecycle so each request releases its
  database connection instead of retaining a Windows file lock.
- 2026-09-29: Added regression coverage for priority ordering plus queued-job
  cancellation and requeue behavior.
- 2026-09-29: Built a fresh portable Magic executable containing the Sorcerer
  client integration (`fantasia/magic/dist/magic-v1.0.0-portable.exe`).
- 2026-09-29: Added a Windows logon-task installer and made `sorcerer.cmd`
  prefer Magic's bundled Python runtime for a repeatable server launch.
- 2026-09-29: Initialized `C:\SorcererData`, issued an initial client token,
  and started the live Sorcerer server on port 8765. Loopback health and
  authenticated queue checks passed.
- 2026-09-29: Added automatic continuation for confirmed workflow stages on
  server-submitted jobs, with test coverage for the remote approval handshake.
- 2026-09-29: Live MHA smoke submission reached the server worker and exposed
  a missing `openpyxl` requirement; added it to Magic's declared dependencies.
- 2026-09-29: Added an embedded-Python workflow launcher after live execution
  exposed that Magic's isolated runtime did not include `scripts/` on its
  import path.
- 2026-09-29: Live authenticated MHA smoke batch completed through the running
  server, including automatic confirmation and result ZIP download. The result
  contained the expected `live_smoke.xlsx` workbook.
- 2026-09-29: Rebuilt Magic with the completed Sorcerer client and `openpyxl`
  runtime dependency; added client-facing remote-batch instructions.
- 2026-09-29: Attempted to install the Sorcerer logon task; Windows denied
  task creation. The running server remains available, and the administrator
  follow-up is documented in `HUMAN.md`.
- 2026-09-29: Confirmed the live server is bound to `0.0.0.0:8765` and accepts
  TCP connections through this workstation's LAN address (`10.18.58.226`).
- 2026-09-29: Added a persistent Magic dashboard panel that lists the current
  authenticated client's Sorcerer jobs and refreshes every ten seconds.
- 2026-09-29: Added access-isolation coverage proving one allowed client token
  cannot list or retrieve another client's jobs.
- 2026-09-29: Rebuilt the portable Magic executable with the persistent
  Sorcerer queue panel.
- 2026-10-02: Added Magic controls for remote job priority, cancellation, and
  requeue directly from the Sorcerer queue panel.
- 2026-10-02: Added API-level test coverage for cancel and requeue actions.
- 2026-10-02: Rebuilt the portable Magic executable with priority, cancel, and
  requeue controls in the Sorcerer queue panel.
- 2026-10-02: Added server commands to list and revoke allowed client tokens,
  including protection against accidental duplicate device names.
- 2026-10-02: Bounded Sorcerer ZIP intake and extraction by expanded size and
  entry count, with regression coverage, so a malformed archive cannot consume
  unbounded server storage.
- 2026-10-02: Closed cancellation and archive-validation edge cases: a
  cancellation observed during input extraction now prevents workflow launch,
  and unsafe ZIP paths are rejected at submission.
- 2026-10-08: Completed the production readiness pass: verified the local-only
  dashboard and LAN health, installed the interactive `Sorcerer Server` logon
  task, configured and validated atomic UBox result publishing, and added
  Magic/Sorcerer CI plus release and rollback guidance.

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
| P0 | Styled-heading remediation | 19,889 findings / 474 courses | ✅ Validated | Correct Canvas item opens, target is selected, save/next remains synchronized |
| P0 | Nondescript-link cleanup | 17,527 / 495 | ✅ Validated | Safe suggestion is applied without auto-saving; unsupported text fails visibly |
| P0 | Color-only identification and optional bold cue | 7,308 / 234 | ✅ Validated | Correct content is selected; reviewer explicitly applies and saves any cue |
| P0 | Filename-based image alternative-text cleanup | 5,070 / 298 | ✅ Validated | Filename cleanup is suggested with visible confirmation and no automatic save |
| P0 | Automatically generated caption review | 3,875 / 245 | ✅ Validated | Correct media opens; platform and UDOIT recheck actions work or fail visibly |
| P0 | Cross-workflow hardening | Protects all current modes | 🧪 In testing | Test-course regression passes; loading, timeout, toast, logging, reload, reporting, and next-issue behavior are reliable |
| P0 | Team installation site and releases | Removes manual GitHub navigation | 🧪 In testing | Public guidance is live; Wand distribution remains intentionally paused pending University IT direction |
| P1 | Table header rows and columns | 3,567 / 276 | In testing | Identify the table and provide safe header guidance or an explicit reviewed edit |
| P1 | Missing headings and skipped heading levels | 4,035 combined; up to 377 courses | In testing | Identify the location and guide a valid heading hierarchy without guessing structure |
| P1 | Links with no text | 1,954 / 304 | In testing | Identify the link and require descriptive text before resolution |
| P2 | Insufficient color contrast | 1,562 / 127 | In testing | Report measured colors and suggest a compliant branded alternative for review |
| P2 | Missing video captions | 1,044 / 164 | In testing | Open the correct media workflow and verify refreshed UDOIT status |
| P2 | Image alternative-text review | Test-course coverage | In testing | Identify generic, lengthy, missing, decorative, duplicated, and linked-image text cases without inventing descriptions |
| P2 | Transcript, readability, and document metadata review | Test-course coverage | In testing | Open the correct source and provide issue-specific reviewer guidance without claiming an automatic repair |
| P2 | Styled tabular data and empty-table review | Test-course coverage | In testing | Identify the relevant content and guide semantic table decisions without guessing structure |
| P2 | External-content review | Production backlog | In testing | Identify the Canvas source and provide reviewer guidance; do not claim third-party content was repaired |
| Deferred | PDF, DOC, PPT, and XLS repair inside Wand | 43,875 file findings | Deferred | Remains outside the extension |

## Feature Ideas

- Connect Wand's local bug and suggestion drafts to a team-approved HTTPS endpoint after ownership, authentication, and retention requirements are decided.
- Add keyboard support for high-frequency review flows, including a reviewer-configurable next shortcut such as `n` for mark/save/advance once the reviewer has confirmed the current issue is ready.
- Add a release checklist that maps GitHub release assets to tested UDOIT issue families so version support is visible without reading commit history.

## Delivery Order

1. Publish the Fantasia guidance site; keep the Wand v1.1.0 package unpublished until University IT responds about distribution.
2. Keep bug and suggestion reports local until the team selects a secure endpoint and ownership model after the University IT response.
3. Add measured color-contrast assistance and continue deeper automation for reviewer-guided P1/P2 workflows.
4. Add Sorcerer to the shared release site when its dashboard and workstation deployment model are ready.
5. Re-run the analytics export after each release cycle and revise priorities when issue counts or completion rates materially change.
