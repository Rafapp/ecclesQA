"""Utility: convert .doc / .docm files to .docx using Word COM.

Not a regular pipeline module — called by the orchestrator as a pre-processing
step before the document is opened, since python-docx cannot read legacy .doc.

For cloud mode the existing Word instance is reused.
For local mode a temporary Word instance is spun up just for the conversion.
"""
from __future__ import annotations

from pathlib import Path

WD_FORMAT_DOCX  = 16   # wdFormatDocumentDefault (.docx)
NEEDS_CONV_EXTS = {".doc", ".docm"}


def needs_conversion(path: Path) -> bool:
    return path.suffix.lower() in NEEDS_CONV_EXTS


def convert(path: Path, word=None, keep_original: bool = False) -> Path:
    """Save path as .docx via Word COM. Returns the new .docx Path.

    Args:
        path:          Source .doc / .docm file.
        word:          Existing Word COM application object to reuse (cloud mode).
                       If None, a temporary instance is created and destroyed.
        keep_original: If False (default), deletes the source file after a
                       successful conversion.
    """
    import pythoncom
    import win32com.client

    target    = path.with_suffix(".docx")
    owns_word = word is None

    if owns_word:
        pythoncom.CoInitialize()
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False

    try:
        doc = word.Documents.Open(str(path), ReadOnly=False, AddToRecentFiles=False)
        doc.SaveAs2(str(target), FileFormat=WD_FORMAT_DOCX)
        doc.Close(SaveChanges=False)
    finally:
        if owns_word:
            word.Quit()
            pythoncom.CoUninitialize()

    if not keep_original and target.exists():
        path.unlink()

    return target
