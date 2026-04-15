from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import pythoncom
    import pywintypes
    import win32com.client
except ImportError as exc:  # pragma: no cover
    missing_dependency_error = exc
else:
    missing_dependency_error = None


DEFAULT_DOWNLOADS = Path(r"C:\Users\u1592528\Downloads")
SUPPORTED_PATTERNS = ("*.xls", "*.xsl")
XL_OPEN_XML_WORKBOOK = 51


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Convert legacy Excel files in a folder to .xlsx format and "
            "remove the original file after a successful save."
        )
    )
    parser.add_argument(
        "--folder",
        type=Path,
        default=DEFAULT_DOWNLOADS,
        help=f"Folder to scan. Defaults to {DEFAULT_DOWNLOADS}",
    )
    parser.add_argument(
        "--keep-original",
        action="store_true",
        help="Keep the original source file after conversion.",
    )
    return parser.parse_args()


def iter_candidate_files(folder: Path) -> list[Path]:
    candidates: list[Path] = []
    for pattern in SUPPORTED_PATTERNS:
        candidates.extend(folder.glob(pattern))
    return sorted(path for path in candidates if path.is_file())


def convert_file(excel_app, source_path: Path, keep_original: bool) -> str:
    target_path = source_path.with_suffix(".xlsx")
    workbook = None

    try:
        print(f"Opening {source_path.name}...")
        workbook = excel_app.Workbooks.Open(str(source_path))
        print(f"Saving {target_path.name}...")
        workbook.SaveAs(str(target_path), FileFormat=XL_OPEN_XML_WORKBOOK)
    except pywintypes.com_error as exc:
        return f"FAILED: {source_path.name} ({exc})"
    finally:
        if workbook is not None:
            workbook.Close(SaveChanges=False)

    if not target_path.exists():
        return f"FAILED: {source_path.name} (Excel did not create {target_path.name})"

    if not keep_original:
        print(f"Deleting original {source_path.name}...")
        source_path.unlink()

    return f"OK: {source_path.name} -> {target_path.name}"


def main() -> int:
    if missing_dependency_error is not None:
        print(
            "This script requires pywin32. Install it with:\n"
            "  py -m pip install pywin32",
            file=sys.stderr,
        )
        print(f"Import error: {missing_dependency_error}", file=sys.stderr)
        return 1

    args = parse_args()
    folder = args.folder.expanduser()

    if not folder.exists():
        print(f"Folder not found: {folder}", file=sys.stderr)
        return 1

    files = iter_candidate_files(folder)
    if not files:
        print(f"No matching files found in {folder}")
        return 0

    print(f"Found {len(files)} file(s) to convert in {folder}")
    print("Starting Excel automation...")

    pythoncom.CoInitialize()
    excel_app = None

    try:
        excel_app = win32com.client.DispatchEx("Excel.Application")
        excel_app.Visible = False
        excel_app.DisplayAlerts = False

        results = []
        for index, path in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] Working on {path.name}")
            results.append(
                convert_file(excel_app, source_path=path, keep_original=args.keep_original)
            )
    except pywintypes.com_error as exc:
        print(f"Unable to start Excel automation: {exc}", file=sys.stderr)
        return 1
    finally:
        if excel_app is not None:
            print("Closing Excel...")
            excel_app.Quit()
        pythoncom.CoUninitialize()

    print("Conversion run complete. Summary:")
    for result in results:
        print(result)

    failed = [result for result in results if result.startswith("FAILED:")]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
