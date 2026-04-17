"""Orchestrator: process Excel files for accessibility."""
from __future__ import annotations

import argparse
from pathlib import Path

from .core import WorkbookStats
from .xls_to_xlsx import convert, needs_conversion

# Register future accessibility modules here (e.g. alt text for charts)
MODULES: list = []

SUPPORTED_PATTERNS = ("*.xls", "*.xlsb", "*.xlsx", "*.xlsm")

DEFAULT_FOLDER = Path.home() / "Downloads"


def _collect_files(folder: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in SUPPORTED_PATTERNS:
        files.extend(folder.glob(pattern))
    return sorted(set(files))


def process_workbook(path: Path, excel) -> WorkbookStats:
    stats = WorkbookStats()

    print(f"\n{'='*60}")
    print(f"File: {path.name}")

    if needs_conversion(path):
        print("  Converting to .xlsx ...")
        path = convert(path, excel=excel)
        stats.files_converted += 1
        print(f"  --> Converted: {path.name}")

    if MODULES:
        import openpyxl
        wb = openpyxl.load_workbook(str(path))
        ctx = {"path": path}
        for module in MODULES:
            print(f"\n[{module.LABEL}]")
            module.run(wb, stats, ctx)
        wb.save(str(path))
        print(f"\n  Saved: {path.name}")

    _print_stats(stats)
    return stats


def _print_stats(stats: WorkbookStats) -> None:
    lines = []
    if stats.files_converted:
        lines.append("converted to .xlsx")
    if lines:
        print("  Summary: " + " | ".join(lines))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Excel accessibility fixer")
    parser.add_argument(
        "folder",
        nargs="?",
        type=Path,
        default=DEFAULT_FOLDER,
        help="Folder to scan (default: ~/Downloads)",
    )
    args = parser.parse_args(argv)

    folder: Path = args.folder
    if not folder.is_dir():
        print(f"Error: '{folder}' is not a directory.")
        return 1

    files = _collect_files(folder)
    to_convert = [f for f in files if needs_conversion(f)]

    if not to_convert:
        print("No legacy Excel files found to convert.")
        return 0

    print(f"Found {len(to_convert)} legacy file(s) to convert in '{folder}'.")

    import pythoncom
    import win32com.client

    pythoncom.CoInitialize()
    excel = win32com.client.DispatchEx("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    failed = 0
    try:
        for path in to_convert:
            try:
                process_workbook(path, excel)
            except Exception as exc:
                print(f"  ERROR processing {path.name}: {exc}")
                failed += 1
    finally:
        excel.Quit()
        pythoncom.CoUninitialize()

    print("\nDone.")
    return 1 if failed else 0
