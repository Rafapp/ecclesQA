"""Shared data structures and text helpers for PDF remediation."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path


TARGET_RULES = (
    "Image-only PDF",
    "Tagged PDF",
    "Tagged content",
    "Title",
    "Primary language",
    "Figures alternate text",
    "Other elements alternate text",
)

FAILED_STATUSES = {"Failed"}

_WHITESPACE_RE = re.compile(r"\s+")
_TEMP_STAGE_RE = re.compile(r"\.__ecclesqa_.*$", re.IGNORECASE)


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return _WHITESPACE_RE.sub(" ", value.replace("\r", " ").replace("\n", " ")).strip()


def default_title_from_path(path: Path) -> str:
    stem = _TEMP_STAGE_RE.sub("", path.stem)
    return clean_text(stem.replace("_", " "))


def title_is_usable(value: str | None) -> bool:
    flat = clean_text(value)
    if len(flat) < 3:
        return False
    lowered = flat.lower()
    if lowered in {"untitled", "untitled.pdf", "document", "pdf document"}:
        return False
    if "\\" in flat or "/" in flat:
        return False
    if "ecclesqa" in lowered:
        return False
    return True


def summarize_statuses(items: list[tuple[str, str]]) -> str:
    return " | ".join(f"{name}={status}" for name, status in items if status)


@dataclass
class PdfStats:
    encrypted_before: bool = False
    security_removed: bool = False
    structure_reset: bool = False
    ocr_applied: bool = False
    autotag_applied: bool = False
    title_updated: bool = False
    lang_set: bool = False
    display_title_set: bool = False
    visuals_seen: int = 0
    figure_tags_seen: int = 0
    alt_generated: int = 0
    alt_already_present: int = 0
    alt_fallback: int = 0
    before_report: Path | None = None
    after_report: Path | None = None
    notes: list[str] = field(default_factory=list)

    def add_note(self, value: str) -> None:
        self.notes.append(value)
