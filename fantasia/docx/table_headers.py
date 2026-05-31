"""Module: mark the first row of every table as a header row for screen readers."""
from __future__ import annotations

from docx.oxml import OxmlElement
from docx.oxml.ns import qn

from .core import DocumentStats

LABEL = "Table headers"


def _ensure_header_row(row) -> bool:
    """Add <w:tblHeader/> to the row's trPr. Returns True if it was newly added."""
    tr = row._tr
    trPr = tr.find(qn("w:trPr"))
    if trPr is None:
        trPr = OxmlElement("w:trPr")
        tr.insert(0, trPr)
    if trPr.find(qn("w:tblHeader")) is not None:
        return False
    trPr.append(OxmlElement("w:tblHeader"))
    return True


def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    tables = doc.tables
    if not tables:
        print("  --> Skipped (no tables found).")
        return

    added = 0
    for table in tables:
        if table.rows and _ensure_header_row(table.rows[0]):
            added += 1

    if added == 0:
        print(f"  --> Skipped ({len(tables)} table(s) already have header rows).")
        return

    stats.tables_header_set += added
    print(f"  --> Set header row on {added}/{len(tables)} table(s).")
