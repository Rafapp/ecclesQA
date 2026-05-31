"""Orchestrator: process Excel files for accessibility."""
from __future__ import annotations

import argparse
from pathlib import Path

from .core import WorkbookStats
from .xls_to_xlsx import convert, needs_conversion
from Accessibility.manifest import JobManifest

# Register future accessibility modules here (e.g. alt text for charts)
MODULES: list = []

SUPPORTED_PATTERNS = ("*.xls", "*.xlsb", "*.xlsx", "*.xlsm")

DEFAULT_FOLDER = Path.home() / "Downloads"


def _collect_files(folder: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in SUPPORTED_PATTERNS:
        files.extend(folder.glob(pattern))
    return sorted(set(files))


def process_workbook(path: Path, excel, manifest: JobManifest) -> WorkbookStats:
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
    manifest.mark_done(path)
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

    # Initialize manifest for tracking progress
    manifest = JobManifest.for_folder(folder)
    
    # Skip if xlsx processing already complete
    if manifest.is_filetype_complete("xlsx"):
        print("XLSX files have already been processed. Skipping.\n")
        return 0

    files = _collect_files(folder)
    to_convert = [f for f in files if needs_conversion(f)]

    if not to_convert:
        print("No legacy Excel files found to convert.")
        return 0

    print(f"Found {len(to_convert)} legacy file(s) to convert in '{folder}'.")

    # Mark that xlsx processing is starting
    manifest.mark_filetype_started("xlsx")

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
                process_workbook(path, excel, manifest)
            except Exception as exc:
                failed += 1
                manifest.mark_failed(path, str(exc))
                print(f"  ERROR processing {path.name}: {exc}")
    finally:
        excel.Quit()
        pythoncom.CoUninitialize()

    print("\nDone.")
    
    # Only mark filetype as complete if no failures
    if failed == 0:
        manifest.mark_filetype_complete("xlsx")
    
    return 1 if failed else 0
