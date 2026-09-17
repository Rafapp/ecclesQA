"""Orchestrator: run all registered docx modules against every Word file in a folder.

Two modes
---------
Local (default):  python-docx only — Word never opens. Fast, no dependencies on
                  pywin32 / pywinauto.
Cloud (--cloud):  Opens each file in Word and uses Word's built-in AI for alt text.
                  Requires pywin32 + pywinauto.

Adding a new module
-------------------
1. Create ``docx/<module>.py`` with a ``LABEL`` string and a
   ``run(doc, stats, ctx)`` function.
   - Local mode:  ``doc`` is a python-docx Document; ``ctx["mode"] == "local"``
   - Cloud mode:  ``doc`` is a COM Document;          ``ctx["mode"] == "cloud"``
2. Import it below and add it to MODULES_LOCAL and/or MODULES_CLOUD.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from .core import DocumentStats
from . import alttext_local, alttext_word_cloud, metadata, headings, table_headers, doc_to_docx
from Accessibility.manifest import JobManifest

# ── Module registries ─────────────────────────────────────────────────────────

MODULES_LOCAL = [alttext_local, metadata, headings, table_headers]
MODULES_CLOUD = [alttext_word_cloud, metadata, headings, table_headers]

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

def process_document_local(path: Path, modules: list) -> DocumentStats:
    from docx import Document

    if doc_to_docx.needs_conversion(path):
        print(f'  Converting "{path.name}" to .docx...')
        path = doc_to_docx.convert(path)
        print(f'  -> "{path.name}"')

    stats = DocumentStats()
    doc = Document(str(path))
    ctx = {"path": path, "mode": "local"}
    success = False
    try:
        for i, module in enumerate(modules, start=1):
            print(f"  [{i}/{len(modules)}] {module.LABEL}")
            module.run(doc, stats, ctx)
        success = True
    finally:
        if success:
            doc.save(str(path))
            print("  Saved.")
        else:
            print("  Skipped save (error occurred).")
    return stats


def process_document_cloud(path: Path, word, ui_app, modules: list) -> DocumentStats:
    stats = DocumentStats()
    doc = None
    success = False

    if doc_to_docx.needs_conversion(path):
        print(f'  Converting "{path.name}" to .docx...')
        path = doc_to_docx.convert(path, word=word)
        print(f'  -> "{path.name}"')

    print(f'  Opening "{path.name}" in Word...')
    try:
        doc = word.Documents.Open(str(path), ReadOnly=False, AddToRecentFiles=False)

        hwnd = int(word.ActiveWindow.Hwnd)
        ui_app.connect(handle=hwnd)
        window = ui_app.window(handle=hwnd)
        window.set_focus()
        time.sleep(0.3)

        ctx = {"path": path, "mode": "cloud", "window": window}

        for i, module in enumerate(modules, start=1):
            print(f"  [{i}/{len(modules)}] {module.LABEL}")
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
        description="Run Word accessibility modules against a folder of .docx files."
    )
    parser.add_argument("--folder", type=Path, default=DEFAULT_DOWNLOADS)
    parser.add_argument(
        "--cloud",
        action="store_true",
        help="Use Word's built-in AI (cloud) for alt text. Requires pywin32 + pywinauto.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    folder = args.folder.expanduser()

    alt_mode = "Word AI (cloud)" if args.cloud else "local BLIP"
    print("==========================================")
    print("  Word Accessibility Cleanup")
    print(f"  Folder:   {folder}")
    print(f"  Alt text: {alt_mode}")
    print("==========================================\n")

    if not folder.exists():
        print(f'ERROR: Folder not found: "{folder}"', file=sys.stderr)
        return 1

    # Initialize manifest for tracking progress
    manifest = JobManifest.for_folder(folder)
    
    # Skip if docx processing already complete
    if manifest.is_filetype_complete("docx"):
        print("DOCX files have already been processed. Skipping.\n")
        return 0

    files = iter_candidate_files(folder)
    if not files:
        print(f'No Word files found in "{folder}".')
        return 0

    print(f"Found {len(files)} file(s).\n")

    # Mark that docx processing is starting
    manifest.mark_filetype_started("docx")

    failed = 0

    if args.cloud:
        try:
            import pythoncom
            import win32com.client
            from pywinauto import Application
        except ImportError as exc:
            print(
                f"ERROR: Cloud mode requires pywin32 + pywinauto.\n"
                f"  pip install pywin32 pywinauto\n{exc}",
                file=sys.stderr,
            )
            return 1

        pythoncom.CoInitialize()
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = True
        ui_app = Application(backend="uia")
        print("Word is running.\n")

        try:
            for index, path in enumerate(files, start=1):
                print(f"[{index}/{len(files)}] {path.name}")
                print("------------------------------------------")
                try:
                    stats = process_document_cloud(path, word, ui_app, MODULES_CLOUD)
                    _print_stats(stats)
                    manifest.mark_done(path)
                except Exception as exc:
                    failed += 1
                    manifest.mark_failed(path, str(exc))
                    print(f"  FAILED: {exc}")
                print()
        finally:
            word.Quit()
            pythoncom.CoUninitialize()

    else:
        try:
            from docx import Document  # noqa: F401 — verify install early
        except ImportError:
            print(
                "ERROR: Local mode requires python-docx.\n"
                "  pip install python-docx",
                file=sys.stderr,
            )
            return 1

        for index, path in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] {path.name}")
            print("------------------------------------------")
            try:
                stats = process_document_local(path, MODULES_LOCAL)
                _print_stats(stats)
                manifest.mark_done(path)
            except Exception as exc:
                failed += 1
                manifest.mark_failed(path, str(exc))
                print(f"  FAILED: {exc}")
            print()

    print("==========================================")
    print(f"  Done — {len(files)} file(s), {failed} failure(s)")
    print("==========================================")
    
    # Only mark filetype as complete if no failures
    if failed == 0:
        manifest.mark_filetype_complete("docx")
    
    return 1 if failed else 0


def _print_stats(stats: DocumentStats) -> None:
    print(
        f"  title={stats.title_updated}  h1={stats.heading1_applied}  "
        f"h2={stats.heading2_applied}  tables_headers={stats.tables_header_set}  "
        f"visuals={stats.visuals_seen}  generated={stats.alt_generated}  "
        f"decorative={stats.alt_decorative}  present={stats.alt_already_present}  "
        f"cleaned={stats.alt_cleaned}"
    )


if __name__ == "__main__":
    raise SystemExit(main())
