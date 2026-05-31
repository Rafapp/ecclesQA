"""Core data structures and shared utilities used across all pptx modules."""
from __future__ import annotations

import re
from dataclasses import dataclass


AI_FOOTER_PATTERN = re.compile(
    r"\s*\n+\s*(?:description automatically generated"
    r"|ai[\s-]?generated content may be incorrect"
    r"|please (?:check|verify)(?: the)?(?: ai| auto(?:matically)?(?: generated)?)? alt text)"
    r"\.?\s*$",
    re.IGNORECASE,
)

BOILERPLATE_ALT_PATTERN = re.compile(
    r"^(?:created with (?:microsoft\s+)?equation editor[\s\d.]*"
    r"|equation"
    r"|object\s+\d+"
    r"|ole\s+object"
    r"|image\s+\d+"
    r"|picture\s+\d+"
    r"|[a-zA-Z]:\\[^\n]+"        # Windows file path e.g. C:\TEMP\scl3.PNG
    r"|/[^\n]+\.[a-zA-Z]{2,5}"   # Unix file path e.g. /tmp/image.png
    r")$",
    re.IGNORECASE,
)


@dataclass
class PresentationStats:
    title_updated: bool = False
    slides_missing_title: int = 0
    alt_generated: int = 0
    alt_already_present: int = 0
    alt_cleaned: int = 0
    visuals_seen: int = 0
    decorative_marked: int = 0


def clean_text(value: str) -> str:
    return " ".join(value.replace("\r", " ").replace("\x07", " ").split()).strip()


def summarize(value: str, max_length: int = 100) -> str:
    flat = " ".join(value.split())
    return flat if len(flat) <= max_length else flat[: max_length - 3] + "..."


def strip_ai_footer(text: str) -> str:
    return AI_FOOTER_PATTERN.sub("", text).strip()
