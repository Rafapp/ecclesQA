"""Core data structures and shared utilities used across all xlsx modules."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class WorkbookStats:
    files_converted: int = 0
