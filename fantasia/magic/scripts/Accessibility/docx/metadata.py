"""Module: set the document Title metadata property to match the filename."""
from __future__ import annotations

from .core import DocumentStats, clean_text

LABEL = "Title metadata"


def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    if ctx.get("mode") == "local":
        _run_local(doc, stats, ctx)
    else:
        _run_cloud(doc, stats, ctx)


def _run_local(doc, stats: DocumentStats, ctx: dict) -> None:
    current = clean_text(doc.core_properties.title or "")
    if current:
        print(f'  --> Skipped (title already set: "{current}").')
        return
    desired = ctx["path"].stem
    doc.core_properties.title = desired
    stats.title_updated = True
    print(f'  --> Set: "{desired}"')


def _run_cloud(doc, stats: DocumentStats, ctx: dict) -> None:
    try:
        current = clean_text(str(doc.BuiltInDocumentProperties("Title").Value or ""))
    except Exception:
        current = ""
    if current:
        print(f'  --> Skipped (title already set: "{current}").')
        return
    desired = ctx["path"].stem
    doc.BuiltInDocumentProperties("Title").Value = desired
    stats.title_updated = True
    print(f'  --> Set: "{desired}"')
