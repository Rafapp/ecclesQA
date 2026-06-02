"""Module: apply Heading 1 to the first paragraph and promote eligible
paragraphs to Heading 2."""
from __future__ import annotations

import re

from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from .core import DocumentStats, clean_text, summarize

LABEL = "Headings"

WD_STYLE_HEADING_1 = -2
WD_STYLE_HEADING_2 = -3


# ── Shared logic (mode-agnostic) ──────────────────────────────────────────────

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
    if ctx.get("mode") == "local":
        _run_local(doc, stats)
    else:
        _run_cloud(doc, stats)


# ── Local path (python-docx) ──────────────────────────────────────────────────

def _run_local(doc, stats: DocumentStats) -> None:
    paragraphs = [p for p in doc.paragraphs if p.text.strip()]
    if not paragraphs:
        print("  --> Skipped (document empty).")
        return

    if any(_is_heading_local(p) for p in paragraphs):
        print("  --> Skipped (headings already present).")
        return

    first = paragraphs[0]
    first_text = clean_text(first.text)

    if not _is_heading_local(first):
        _set_heading_style(first, 1)
        stats.heading1_applied = True
        print(f'  --> Heading 1: "{summarize(first_text)}"')
    else:
        print(f'  --> First paragraph already a heading: "{summarize(first_text)}"')

    applied = 0
    for p in paragraphs[1:]:
        text = clean_text(p.text)
        if _should_promote_to_heading2(text) and not _is_heading_local(p):
            _set_heading_style(p, 2)
            applied += 1
            print(f'  --> Heading 2: "{summarize(text)}"')

    stats.heading2_applied = applied
    if not applied:
        print("  --> No Heading 2 candidates.")


def _is_heading_local(paragraph) -> bool:
    val = (_pstyle_val(paragraph) or "").lower()
    return "heading" in val or val == "title"


def _pstyle_val(paragraph) -> str | None:
    """Return the raw w:pStyle val attribute, or None if absent."""
    pPr = paragraph._p.find(qn("w:pPr"))
    if pPr is None:
        return None
    pStyle = pPr.find(qn("w:pStyle"))
    return pStyle.get(qn("w:val")) if pStyle is not None else None


def _set_heading_style(paragraph, level: int) -> None:
    """Set heading style directly in XML — works even if the style isn't in the style table."""
    pPr = paragraph._p.find(qn("w:pPr"))
    if pPr is None:
        pPr = OxmlElement("w:pPr")
        paragraph._p.insert(0, pPr)
    pStyle = pPr.find(qn("w:pStyle"))
    if pStyle is None:
        pStyle = OxmlElement("w:pStyle")
        pPr.insert(0, pStyle)
    pStyle.set(qn("w:val"), f"Heading{level}")


# ── Cloud path (COM) ──────────────────────────────────────────────────────────

def _run_cloud(doc, stats: DocumentStats) -> None:
    first = _first_non_empty_cloud(doc)
    if first is None:
        print("  --> Skipped (document empty).")
        return

    if any(_is_heading_cloud(p) for p in doc.Paragraphs):
        print("  --> Skipped (headings already present).")
        return

    first_text = clean_text(first.Range.Text)
    if not _is_heading_cloud(first):
        first.Range.Style = WD_STYLE_HEADING_1
        stats.heading1_applied = True
        print(f'  --> Heading 1: "{summarize(first_text)}"')
    else:
        print(f'  --> First paragraph already a heading: "{summarize(first_text)}"')

    applied = 0
    for p in doc.Paragraphs:
        if p is first:
            continue
        text = clean_text(p.Range.Text)
        if _should_promote_to_heading2(text) and not _is_heading_cloud(p):
            p.Range.Style = WD_STYLE_HEADING_2
            applied += 1
            print(f'  --> Heading 2: "{summarize(text)}"')

    stats.heading2_applied = applied
    if not applied:
        print("  --> No Heading 2 candidates.")


def _is_heading_cloud(paragraph) -> bool:
    try:
        style = paragraph.Range.Style
        name = clean_text(getattr(style, "NameLocal", str(style))).lower().replace("-", " ")
        return "heading" in name or name.strip() == "title"
    except Exception:
        return False


def _first_non_empty_cloud(document):
    for p in document.Paragraphs:
        if clean_text(p.Range.Text):
            return p
    return None
