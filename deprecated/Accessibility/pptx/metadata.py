"""Module: set the presentation Title metadata property to match the filename."""
from __future__ import annotations

from .core import PresentationStats, clean_text

LABEL = "Title metadata"


def run(prs, stats: PresentationStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    current = clean_text(prs.core_properties.title or "")
    if current:
        print(f'  --> Skipped (title already set: "{current}").')
        return
    desired = ctx["path"].stem
    prs.core_properties.title = desired
    stats.title_updated = True
    print(f'  --> Set: "{desired}"')
