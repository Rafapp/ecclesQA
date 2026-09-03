import test from "node:test";
import assert from "node:assert/strict";
import { getFilenameLabelSuggestion } from "../src/shared/filenameLabel.ts";
import { cleanNondescriptLinkText, getLinkTextSuggestion } from "../src/shared/linkText.ts";
import { ADVANCE_PENDING_MAX_AGE_MS, getRemediationDefinition, isAdvancePendingFresh, SUPPORTED_REMEDIATIONS } from "../src/shared/remediation.ts";

test("cleans common document link filenames", () => {
  assert.equal(
    cleanNondescriptLinkText("Newell Rubbermaid to Acquire Jarden for $15 Billion - WSJ.pdf"),
    "Newell Rubbermaid to Acquire Jarden for $15 Billion - WSJ"
  );
  assert.equal(
    cleanNondescriptLinkText("The_Most_Valuable_Company_for_Now_Is_Having_a_Nadellaissance.pdf"),
    "The Most Valuable Company for Now Is Having a Nadellaissance"
  );
  assert.equal(cleanNondescriptLinkText("US Office Products (B)- Operational.pdf"), "US Office Products (B) - Operational");
});

test("preserves meaningful punctuation across the supplied link dataset", () => {
  const cases = [
    ["Marks and Spencer, Ltd. (A).pdf", "Marks and Spencer, Ltd. (A)"],
    ["Marks and Spencer, Ltd. (B).pdf", "Marks and Spencer, Ltd. (B)"],
    ["Cadbury Schweppes-Capturing Confectionery A.pdf", "Cadbury Schweppes-Capturing Confectionery A"],
    ["Cadbury Schweppes- Capturing Confectionery- B.pdf", "Cadbury Schweppes - Capturing Confectionery - B"],
    ["US Office Products (A).pdf", "US Office Products (A)"],
    ["Portfolio Planning at Ciba-Geigy and the Newport Investment Proposal.pdf", "Portfolio Planning at Ciba-Geigy and the Newport Investment Proposal"],
    ["The Walt Disney Company and Pixar Inc.: To Acquire or Not to Acquire?.pdf", "The Walt Disney Company and Pixar Inc.: To Acquire or Not to Acquire?"],
    ["GE's Two-Decade Transformation: Jack Welch's Leadership.pdf", "GE's Two-Decade Transformation: Jack Welch's Leadership"],
    ["Danaher Corporation.pdf", "Danaher Corporation"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(cleanNondescriptLinkText(input), expected);
  }
});

test("does not invent descriptions for generic text or URLs", () => {
  assert.equal(getLinkTextSuggestion("click here"), null);
  assert.equal(getLinkTextSuggestion("https://example.com/report.pdf"), null);
});

test("cleans image filename alternative text", () => {
  assert.equal(getFilenameLabelSuggestion("fixture-image-04.png"), "Fixture image 04");
  assert.equal(getFilenameLabelSuggestion("photo-copy-2.PNG"), "Photo");
  assert.equal(getFilenameLabelSuggestion("images/The_Most_Valuable_Company.jpg?download=1"), "The Most Valuable Company");
});

test("registers all sprint remediations and caption alias", () => {
  assert.equal(SUPPORTED_REMEDIATIONS.length, 30);
  assert.equal(getRemediationDefinition("Closed Captions Were Auto-Generated")?.actionLabel, "Review video captions");
  assert.equal(
    getRemediationDefinition("Potential use of color alone to communicate information")?.workspaceActions?.[0]?.action,
    "apply-color-cue"
  );
  assert.equal(getRemediationDefinition("No table headers found")?.udoitActions?.[0]?.action, "expand-preview");
  assert.equal(getRemediationDefinition("Insufficient color contrast")?.actionLabel, "Review color contrast");
  assert.equal(
    getRemediationDefinition("Linked or embedded external content may not meet accessibility standards")?.actionLabel,
    "Review external content"
  );
});

test("recognizes every page issue exported by the UDOIT test course", () => {
  const exportedIssueTypes = [
    "Alternative text appears to be a generic placeholder",
    "Alternative text is too lengthy for optimal screen reader experience",
    "Alternative text uses filename rather than a descriptive label",
    "Caption status could not be verified for this video",
    "Content may exceed recommended length for readability (3000+ words)",
    "Decorative image does not have an empty alternative text",
    "Deprecated font tag in use",
    "Document reading direction not found",
    "Embedded video is missing captions",
    "Headings may be missing",
    "Image does not include an alt\" attribute\"",
    "Image long description is identical to alternative text",
    "Insufficient text color contrast with the background",
    "Link does not contain text",
    "Link has nondescript text",
    "Linked image does not have a descriptive alternative text",
    "Links to multimedia require transcripts",
    "Links to sound files need transcripts",
    "One or more heading elements do not contain text",
    "Page contains skipped headings",
    "Potential use of color alone to communicate information",
    "Styles might be used for tabular data where semantic markup may be more appropriate",
    "Styles might be used instead of semantic markup for structure",
    "Table does not include header rows or columns",
    "Table headers are missing row or column scope attributes",
    "Table without content detected",
    "Video captions appear to be automatically generated and may contain errors",
  ];

  for (const issueType of exportedIssueTypes) {
    assert.ok(getRemediationDefinition(issueType), `Missing remediation definition for: ${issueType}`);
  }
});

test("expires stale next-issue requests", () => {
  const now = 100000;
  assert.equal(isAdvancePendingFresh(now, now), true);
  assert.equal(isAdvancePendingFresh(now - ADVANCE_PENDING_MAX_AGE_MS, now), true);
  assert.equal(isAdvancePendingFresh(now - ADVANCE_PENDING_MAX_AGE_MS - 1, now), false);
  assert.equal(isAdvancePendingFresh(now + 1, now), false);
  assert.equal(isAdvancePendingFresh("100000", now), false);
});
