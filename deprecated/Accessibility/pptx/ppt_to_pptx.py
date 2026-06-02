"""Utility: convert .ppt / .pptm files to .pptx using PowerPoint COM.

Called by the orchestrator as a pre-processing step before the presentation is
opened, since python-pptx cannot read legacy .ppt files.

If a PowerPoint COM app object is provided it is reused; otherwise a temporary
instance is created and destroyed.
"""
from __future__ import annotations

from pathlib import Path

PP_FORMAT_PPTX  = 24   # ppSaveAsOpenXMLPresentation (.pptx)
NEEDS_CONV_EXTS = {".ppt", ".pptm"}


def needs_conversion(path: Path) -> bool:
    return path.suffix.lower() in NEEDS_CONV_EXTS


def convert(path: Path, powerpoint=None, keep_original: bool = False) -> Path:
    """Save path as .pptx via PowerPoint COM. Returns the new .pptx Path.

    Args:
        path:          Source .ppt / .pptm file.
        powerpoint:    Existing PowerPoint COM app to reuse. If None, a temporary
                       instance is created and destroyed.
        keep_original: If False (default), deletes the source file after a
                       successful conversion.
    """
    import pythoncom
    import win32com.client

    target    = path.with_suffix(".pptx")
    owns_app  = powerpoint is None

    if owns_app:
        pythoncom.CoInitialize()
        powerpoint = win32com.client.Dispatch("PowerPoint.Application")

    try:
        prs = powerpoint.Presentations.Open(str(path), WithWindow=False)
        prs.SaveAs(str(target), FileFormat=PP_FORMAT_PPTX)
        prs.Close()
    finally:
        if owns_app:
            powerpoint.Quit()
            pythoncom.CoUninitialize()

    if not keep_original and target.exists():
        path.unlink()

    return target
