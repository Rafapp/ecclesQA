"""Module: apply Heading 1 to the first paragraph and promote eligible
paragraphs to Heading 2."""
from __future__ import annotations

import re

from .core import DocumentStats, clean_text, summarize

LABEL = "Headings"

WD_STYLE_HEADING_1 = -2
WD_STYLE_HEADING_2 = -3


# ── Paragraph helpers ─────────────────────────────────────────────────────────

def _style_name(paragraph) -> str:
    try:
        style = paragraph.Range.Style
        return clean_text(getattr(style, "NameLocal", str(style)))
    except Exception:
        return ""


def _is_heading_style(paragraph) -> bool:
    name = _style_name(paragraph).lower().replace("-", " ")
    return "heading" in name or name.strip() == "title"


def _paragraph_text(paragraph) -> str:
    return clean_text(paragraph.Range.Text)


def _first_non_empty_paragraph(document):
    for p in document.Paragraphs:
        if _paragraph_text(p):
            return p
    return None


def _should_promote_to_heading2(text: str) -> bool:
    if not text or len(text) > 90:
        return False
    if "\t" in text or "," in text:
        return False
    if text.endswith((".", "!", "?", ";")):
        return False
    if re.match(r"^(\d+[\.\)]|[A-Za-z][\.\)]|[-*])\s+", text):
        return False
    word_count = len(text.split())
    if not 2 <= word_count <= 10:
        return False
    return text == text.title() or text.isupper() or len(text) <= 45


# ── Public module interface ───────────────────────────────────────────────────

def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    first = _first_non_empty_paragraph(doc)
    if first is None:
        print("  --> Document empty, skipping.")
        return

    first_text = _paragraph_text(first)
    if not _is_heading_style(first):
        first.Range.Style = WD_STYLE_HEADING_1
        stats.heading1_applied = True
        print(f'  --> Heading 1: "{summarize(first_text)}"')
    else:
        print(f'  --> First paragraph already a heading: "{summarize(first_text)}"')

    applied = 0
    for p in doc.Paragraphs:
        if p is first:
            continue
        text = _paragraph_text(p)
        if _should_promote_to_heading2(text) and not _is_heading_style(p):
            p.Range.Style = WD_STYLE_HEADING_2
            applied += 1
            print(f'  --> Heading 2: "{summarize(text)}"')

    stats.heading2_applied = applied
    if not applied:
        print("  --> No Heading 2 candidates.")
