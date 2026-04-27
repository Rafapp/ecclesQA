"""Orchestrator: process .pptx / .ppt files for accessibility."""
from __future__ import annotations

import argparse
from pathlib import Path

from pptx import Presentation

from . import alttext_local, decorative, metadata
from .core import PresentationStats
from .ppt_to_pptx import convert, needs_conversion
from Accessibility.manifest import JobManifest

MODULES = [alttext_local, decorative, metadata]

SUPPORTED_PATTERNS = ("*.pptx", "*.pptm", "*.ppt")

DEFAULT_FOLDER = Path.home() / "Downloads"


def _collect_files(folder: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in SUPPORTED_PATTERNS:
        files.extend(f for f in folder.glob(pattern) if not f.name.startswith("~$"))
    return sorted(set(files))


def process_presentation(path: Path, manifest: JobManifest) -> None:
    print(f"\n{'='*60}")
    print(f"File: {path.name}")

    if needs_conversion(path):
        print("  Converting to .pptx ...")
        path = convert(path)
        print(f"  --> Converted: {path.name}")

    prs = Presentation(str(path))
    stats = PresentationStats()
    ctx = {"path": path}

    for module in MODULES:
        print(f"\n[{module.LABEL}]")
        module.run(prs, stats, ctx)

    prs.save(str(path))
    print(f"\n  Saved: {path.name}")
    _print_stats(stats)
    manifest.mark_done(path)


def _print_stats(stats: PresentationStats) -> None:
    lines = []
    if stats.title_updated:
        lines.append("title metadata set")
    if stats.decorative_marked:
        lines.append(f"{stats.decorative_marked} shape(s) marked decorative")
    if stats.alt_generated:
        lines.append(f"{stats.alt_generated} alt text(s) generated")
    if stats.alt_already_present:
        lines.append(f"{stats.alt_already_present} already had alt text")
    if stats.alt_cleaned:
        lines.append(f"{stats.alt_cleaned} alt text(s) cleaned")
    if lines:
        print("  Summary: " + " | ".join(lines))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PPTX accessibility fixer (local mode)"
    )
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
    
    # Skip if pptx processing already complete
    if manifest.is_filetype_complete("pptx"):
        print("PPTX files have already been processed. Skipping.\n")
        return 0

    files = _collect_files(folder)
    if not files:
        print(f"No supported files found in '{folder}'.")
        return 0

    print(f"Found {len(files)} file(s) in '{folder}'.")
    
    # Mark that pptx processing is starting
    manifest.mark_filetype_started("pptx")
    
    failed = 0
    for path in files:
        try:
            process_presentation(path, manifest)
        except Exception as exc:
            failed += 1
            manifest.mark_failed(path, str(exc))
            print(f"  ERROR processing {path.name}: {exc}")

    print("\nDone.")
    
    # Only mark filetype as complete if no failures
    if failed == 0:
        manifest.mark_filetype_complete("pptx")
    
    return 1 if failed else 0
