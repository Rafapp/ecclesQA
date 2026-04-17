"""Orchestrator: run all registered docx modules against every Word file in a folder.

Adding a new module
-------------------
1. Create ``docx/<module>.py`` with a ``LABEL`` string and a
   ``run(doc, stats, ctx)`` function (see existing modules for the signature).
2. Import it below and append it to ``MODULES``.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

try:
    import pythoncom
    import win32com.client
except ImportError as exc:
    print(
        f"ERROR: pywin32 is required. Install with: python -m pip install pywin32\n{exc}",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from pywinauto import Application
except ImportError as exc:
    print(
        f"ERROR: pywinauto is required. Install with: python -m pip install pywinauto\n{exc}",
        file=sys.stderr,
    )
    sys.exit(1)

from .core import DocumentStats
from . import alttext_word_cloud, metadata, headings

# ── Module registry ───────────────────────────────────────────────────────────
# Add new modules here in the order they should run.
# Swap alttext_word_cloud for alttext_local to use offline BLIP generation.
MODULES = [
    alttext_word_cloud,
    metadata,
    headings,
]

# ── File discovery ────────────────────────────────────────────────────────────

DEFAULT_DOWNLOADS = Path(r"C:\Users\u1592528\Downloads")
SUPPORTED_PATTERNS = ("*.docx", "*.docm", "*.doc")


def iter_candidate_files(folder: Path) -> list[Path]:
    return sorted(
        p
        for pat in SUPPORTED_PATTERNS
        for p in folder.glob(pat)
        if p.is_file() and not p.name.startswith("~$")
    )


# ── Document processing ───────────────────────────────────────────────────────

def process_document(path: Path, word, ui_app: Application) -> DocumentStats:
    stats = DocumentStats()
    doc = None
    success = False

    print(f'  Opening "{path.name}"...')
    try:
        doc = word.Documents.Open(str(path), ReadOnly=False, AddToRecentFiles=False)

        hwnd = int(word.ActiveWindow.Hwnd)
        ui_app.connect(handle=hwnd)
        window = ui_app.window(handle=hwnd)
        window.set_focus()
        time.sleep(0.3)

        ctx = {"path": path, "window": window}

        for i, module in enumerate(MODULES, start=1):
            print(f"  [{i}/{len(MODULES)}] {module.LABEL}")
            module.run(doc, stats, ctx)

        success = True

    finally:
        if doc is not None:
            if success:
                doc.Save()
                print("  Saved.")
            else:
                print("  Skipped save (error occurred).")
            doc.Close(SaveChanges=False)

    return stats


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run all Word accessibility modules against a folder of .docx files."
    )
    parser.add_argument("--folder", type=Path, default=DEFAULT_DOWNLOADS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    folder = args.folder.expanduser()

    print("==========================================")
    print("  Word Accessibility Cleanup")
    print(f"  Folder: {folder}")
    print("==========================================\n")

    if not folder.exists():
        print(f'ERROR: Folder not found: "{folder}"', file=sys.stderr)
        return 1

    files = iter_candidate_files(folder)
    if not files:
        print(f'No Word files found in "{folder}".')
        return 0

    print(f"Found {len(files)} file(s).\n")

    pythoncom.CoInitialize()
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = True
    ui_app = Application(backend="uia")
    print("Word is running.\n")

    failed = 0

    try:
        for index, path in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] {path.name}")
            print("------------------------------------------")
            try:
                stats = process_document(path, word, ui_app)
                print(
                    f"  title={stats.title_updated}  h1={stats.heading1_applied}  "
                    f"h2={stats.heading2_applied}  visuals={stats.visuals_seen}  "
                    f"generated={stats.alt_generated}  decorative={stats.alt_decorative}  "
                    f"present={stats.alt_already_present}  cleaned={stats.alt_cleaned}"
                )
            except Exception as exc:
                failed += 1
                print(f"  FAILED: {exc}")
            print()

    finally:
        word.Quit()
        pythoncom.CoUninitialize()

    print("==========================================")
    print(f"  Done — {len(files)} file(s), {failed} failure(s)")
    print("==========================================")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
