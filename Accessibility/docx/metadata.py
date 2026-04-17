"""Module: set the document Title metadata property to match the filename."""
from __future__ import annotations

from .core import DocumentStats, clean_text

LABEL = "Title metadata"


def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator.

    Required ctx keys:
        path — pathlib.Path of the document file
    """
    path = ctx["path"]
    desired_title = path.stem

    try:
        current_title = str(doc.BuiltInDocumentProperties("Title").Value or "").strip()
    except Exception:
        current_title = ""

    if clean_text(current_title) != desired_title:
        doc.BuiltInDocumentProperties("Title").Value = desired_title
        stats.title_updated = True
        print(f'  --> Updated: "{current_title}" -> "{desired_title}"')
    else:
        print(f'  --> Already correct: "{desired_title}"')
