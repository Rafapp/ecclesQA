"""Utility: convert .xls / .xlsb files to .xlsx using Excel COM."""
from __future__ import annotations

from pathlib import Path

XL_OPEN_XML_WORKBOOK = 51
NEEDS_CONV_EXTS = {".xls", ".xlsb"}


def needs_conversion(path: Path) -> bool:
    return path.suffix.lower() in NEEDS_CONV_EXTS


def convert(path: Path, excel=None, keep_original: bool = False) -> Path:
    """Save path as .xlsx via Excel COM. Returns the new .xlsx Path.

    Args:
        path:          Source .xls / .xlsb file.
        excel:         Existing Excel COM app to reuse. If None, a temporary
                       instance is created and destroyed.
        keep_original: If False (default), deletes the source file after a
                       successful conversion.
    """
    import pythoncom
    import win32com.client

    target = path.with_suffix(".xlsx")
    owns_app = excel is None

    if owns_app:
        pythoncom.CoInitialize()
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

    try:
        wb = excel.Workbooks.Open(str(path))
        wb.SaveAs(str(target), FileFormat=XL_OPEN_XML_WORKBOOK)
        wb.Close(SaveChanges=False)
    finally:
        if owns_app:
            excel.Quit()
            pythoncom.CoUninitialize()

    if not keep_original and target.exists():
        path.unlink()

    return target
