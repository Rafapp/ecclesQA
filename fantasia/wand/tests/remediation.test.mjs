import test from "node:test";
import assert from "node:assert/strict";
import { getFilenameLabelSuggestion } from "../src/shared/filenameLabel.ts";
import { cleanNondescriptLinkText, getLinkTextSuggestion } from "../src/shared/linkText.ts";
import { getRemediationDefinition, SUPPORTED_REMEDIATIONS } from "../src/shared/remediation.ts";

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
  assert.equal(SUPPORTED_REMEDIATIONS.length, 15);
  assert.equal(getRemediationDefinition("Closed Captions Were Auto-Generated")?.actionLabel, "Review video captions");
  assert.equal(
    getRemediationDefinition("Potential use of color alone to communicate information")?.workspaceActions?.[0]?.action,
    "apply-color-cue"
  );
  assert.equal(getRemediationDefinition("No table headers found")?.udoitActions?.[0]?.action, "expand-preview");
  assert.equal(getRemediationDefinition("Insufficient color contrast")?.actionLabel, "Review color contrast");
});
