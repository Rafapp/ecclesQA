"""Core data structures and shared utilities used across all docx modules."""
from __future__ import annotations

import re
from dataclasses import dataclass, field


AI_FOOTER_PATTERN = re.compile(
    r"\s*\n+\s*(?:description automatically generated"
    r"|ai[\s-]?generated content may be incorrect"
    r"|please (?:check|verify)(?: the)?(?: ai| auto(?:matically)?(?: generated)?)? alt text)"
    r"\.?\s*$",
    re.IGNORECASE,
)


@dataclass
class DocumentStats:
    title_updated: bool = False
    heading1_applied: bool = False
    heading2_applied: int = 0
    alt_generated: int = 0
    alt_decorative: int = 0
    alt_already_present: int = 0
    alt_cleaned: int = 0
    visuals_seen: int = 0


def clean_text(value: str) -> str:
    return " ".join(value.replace("\r", " ").replace("\x07", " ").split()).strip()


def summarize(value: str, max_length: int = 100) -> str:
    flat = " ".join(value.split())
    return flat if len(flat) <= max_length else flat[: max_length - 3] + "..."


def strip_ai_footer(text: str) -> str:
    return AI_FOOTER_PATTERN.sub("", text).strip()
