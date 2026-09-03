# Wand Remediation Support

Wand recognizes every non-file issue type in the current Rafael's Test Course UDOIT export. Support is intentionally tiered so subjective accessibility decisions remain with the reviewer.

## Assisted remediation

| Issue family | Assistance |
| --- | --- |
| Nondescript link text | Cleans safe filename-like text for review without saving |
| Filename-based image alternative text | Cleans the filename into a starting label for review without saving |
| Color-only communication | Selects the matching Canvas content and offers an explicit bold-cue action |
| Automatically generated, missing, or unverifiable captions | Opens the Canvas source and provides media-platform and caption-status actions |
| Missing table headers or header scopes | Opens the source and provides preview and explicit save/next controls |

## Reviewer-guided remediation

Wand opens the matching Canvas source, identifies the target when UDOIT provides one, and displays issue-specific guidance for:

- Generic, lengthy, missing, decorative, duplicated, or linked-image alternative text.
- Missing, empty, or skipped headings.
- Empty links.
- Insufficient color contrast.
- Multimedia and audio transcripts.
- Linked or embedded third-party content.
- Deprecated font markup and missing document direction.
- Long content that may need restructuring.
- Tabular-looking content, empty tables, layout tables, and list formatting.

## Product boundary

File findings for PDF, Word, PowerPoint, and Excel remain outside Wand. Wand does not silently save subjective corrections or claim that third-party media has been repaired.
