# Wand sprint validation

Load `fantasia/wand/dist` as the unpacked extension, open Rafael's Test Course only, and use the Wand popup's **Reload Wand** button after each new build.

## Quick regression pass

1. Open a supported UDOIT review item and confirm the Wand action label matches the issue type.
2. Open an unsupported item and confirm the red error reads: “Format issue not supported yet. If you'd like support, flag it to the team!”
3. Expand the remediation-support list, then click elsewhere and confirm it closes.
4. Open and close UDOIT's **Filters** drawer and confirm Wand continues to prompt for a Review item instead of reporting an unsupported format.
5. For styled headings, confirm Wand opens the matching Canvas editor and selects the flagged heading.
6. For a nondescript link, confirm Wand replaces the UDOIT field with cleaned text, removes the selection, and shows a success message.
7. For color-only content, confirm Wand selects the text. Click **Add bold cue to selection**, verify bold is applied, then save manually.
8. For filename alternative text, confirm Wand fills the alternative-text field with a cleaned suggestion and shows a success message.
9. For automatically generated captions, confirm Wand opens the matching Canvas page. Click **Open video platform**, then **Check captions again** after any correction.
10. Click **Mark as resolved and go to next** only on disposable test issues. Confirm UDOIT advances and the Canvas workspace changes to the next issue.
11. Turn Wand off and on in its popup and confirm supported open tabs refresh. Confirm **Reload Wand** reloads the extension and those tabs.
12. If advancing cannot complete, confirm Wand stops loading, shows a bug code, and does not unexpectedly advance an issue after a later page reload.

## Full taxonomy spot checks

The current test-course CSV contains 27 distinct page issue names. Automated tests verify that every exported name maps to a Wand definition. For a live release pass, sample at least one issue from each group:

1. Image text: generic, lengthy, missing, decorative, duplicate long description, and linked image.
2. Structure: missing, empty, and skipped headings; deprecated font markup; document direction; and long content.
3. Links and media: empty link, nondescript link, transcript requirements, missing captions, unverifiable captions, and automatic captions.
4. Tables and lists: missing headers, missing scopes, empty table, tabular-looking content, layout table, and list formatting.
5. Visual presentation: insufficient contrast and possible use of color alone.

For guided modes, success means Wand identifies the issue, opens the correct Canvas source, highlights the target when UDOIT supplies one, and displays accurate guidance. It does not mean Wand automatically saves a subjective correction.

Do not publish the test course. If UDOIT changes a control label or Canvas opens the wrong item, capture the issue name, source title, Wand toast, and browser console entry beginning with `[wand]` for the team.
