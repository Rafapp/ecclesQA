# Wand Live UDOIT Validation

Validation target: Rafael's Test Course, UDOIT scan dated September 3, 2026.

The course export contains 284 active page findings across 27 distinct issue types. Each row below was searched by its live UDOIT label and opened in the review modal. A passing modal check means Wand recognized the live title and displayed a concrete assisted or reviewer-guided action. Shared Canvas, text-input, media, and UDOIT save/advance paths are validated separately so destructive saves are not required for every fixture.

| Live UDOIT issue | Wand assistance | Modal check |
| --- | --- | :-: |
| Alternative text appears to be a generic placeholder | Reviewer edit plus save/next | Pass |
| Alternative text is too lengthy for optimal screen reader experience | Reviewer shortening plus save/next | Pass |
| Alternative text uses filename rather than a descriptive label | Filename cleanup plus save/next | Pass |
| Caption status could not be verified for this video | Canvas/media opening and caption recheck | Pass |
| Content may exceed recommended length for readability (3000+ words) | Canvas source and restructuring guidance | Pass |
| Decorative image does not have an empty alternative text | Reviewer edit plus save/next | Pass |
| Deprecated font tag in use | Canvas source and replacement guidance | Pass |
| Document reading direction not found | Canvas source and direction guidance | Pass |
| Embedded video is missing captions | Canvas/media opening and caption recheck | Pass |
| Headings may be missing | Canvas source and heading guidance | Pass |
| Image does not include an "alt" attribute | Reviewer edit plus save/next | Pass |
| Image long description is identical to alternative text | Reviewer edit plus save/next | Pass |
| Insufficient text color contrast with the background | Canvas source and contrast guidance | Pass |
| Link does not contain text | Reviewer edit plus save/next | Pass |
| Link has nondescript text | Safe filename cleanup plus save/next | Pass |
| Linked image does not have a descriptive alternative text | Reviewer edit plus save/next | Pass |
| Links to multimedia require transcripts | Canvas source and transcript guidance | Pass |
| Links to sound files need transcripts | Canvas source and transcript guidance | Pass |
| One or more heading elements do not contain text | Prepare removal, reviewer entry, and save/next | Pass |
| Page contains skipped headings | UDOIT heading controls, Canvas source, and save/next | Pass |
| Potential use of color alone to communicate information | Target selection and optional bold cue | Pass |
| Styles might be used for tabular data where semantic markup may be more appropriate | Canvas source and semantic-table guidance | Pass |
| Styles might be used instead of semantic markup for structure | Canvas source and target selection | Pass |
| Table does not include header rows or columns | Preview plus save/next | Pass |
| Table headers are missing row or column scope attributes | Preview plus save/next | Pass |
| Table without content detected | Canvas source and empty-table guidance | Pass |
| Video captions appear to be automatically generated and may contain errors | Canvas/media opening and caption recheck | Pass |

## Shared workflow evidence

- UDOIT text manipulation: nondescript-link and filename-based alternative-text suggestions were applied without saving.
- Canvas targeting: styled-heading and skipped-heading fixtures opened the correct Canvas page and selected the implicated heading.
- Guided Canvas workflow: representative image and structural findings opened the matching source and displayed issue-specific guidance.
- Media workflow: missing, unverifiable, and automatically generated caption findings expose media-platform and UDOIT recheck actions.
- UDOIT controls: table preview and save/next actions are discovered by accessible label rather than generated CSS classes.
- Empty-content workflows: empty headings and empty tables are recognized without relying on preview text; the heading helper selects UDOIT's deletion option without saving it.
- Failure handling: missing controls, stale advance requests, source-capture failures, and next-issue synchronization failures produce visible bug codes and copyable diagnostics.

No validation step saves, resolves, or publishes course content unless explicitly identified as a disposable destructive test.
