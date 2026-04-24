"""Security handling for PDFs before Acrobat automation begins."""
from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from .core import PdfStats


@dataclass(frozen=True)
class SecurityInfo:
    encrypted: bool
    blank_password_works: bool


def inspect_security(path: Path) -> SecurityInfo:
    reader = PdfReader(str(path), strict=False)
    if not reader.is_encrypted:
        return SecurityInfo(encrypted=False, blank_password_works=False)

    unlocked = bool(reader.decrypt(""))
    return SecurityInfo(encrypted=True, blank_password_works=unlocked)


def prepare_working_copy(source: Path, working: Path, stats: PdfStats) -> SecurityInfo:
    info = inspect_security(source)
    stats.encrypted_before = info.encrypted

    if not info.encrypted:
        shutil.copy2(source, working)
        return info

    if not info.blank_password_works:
        raise RuntimeError(
            "PDF is encrypted and could not be opened with a blank password. "
            "This workflow can only auto-remove blank-password / restrictions-only security."
        )

    reader = PdfReader(str(source), strict=False)
    if not reader.decrypt(""):
        raise RuntimeError("Failed to decrypt PDF with a blank password.")

    writer = PdfWriter(clone_from=reader)
    with working.open("wb") as fh:
        writer.write(fh)

    stats.security_removed = True
    return info

