# Wand sprint validation

Load `fantasia/wand/dist` as the unpacked extension, open Rafael's Test Course only, and use the Wand popup's **Reload Wand** button after each new build.

## Quick regression pass

1. Open a supported UDOIT review item and confirm the Wand action label matches the issue type.
2. Open an unsupported item and confirm the red error reads: “Format issue not supported yet. If you'd like support, flag it to the team!”
3. Expand the remediation-support list, then click elsewhere and confirm it closes.
4. For styled headings, confirm Wand opens the matching Canvas editor and selects the flagged heading.
5. For a nondescript link, confirm Wand replaces the UDOIT field with cleaned text, removes the selection, and shows a success message.
6. For color-only content, confirm Wand selects the text. Click **Add bold cue to selection**, verify bold is applied, then save manually.
7. For filename alternative text, confirm Wand fills the alternative-text field with a cleaned suggestion and shows a success message.
8. For automatically generated captions, confirm Wand opens the matching Canvas page. Click **Open video platform**, then **Check captions again** after any correction.
9. Click **Mark as resolved and go to next** only on disposable test issues. Confirm UDOIT advances and the Canvas workspace changes to the next issue.
10. Turn Wand off and on in its popup and confirm supported open tabs refresh. Confirm **Reload Wand** reloads the extension and those tabs.

Do not publish the test course. If UDOIT changes a control label or Canvas opens the wrong item, capture the issue name, source title, Wand toast, and browser console entry beginning with `[wand]` for the team.
