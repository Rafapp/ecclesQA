"""Orchestrator for Acrobat-backed PDF accessibility remediation."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from . import alttext_local, metadata, security, structure
from .acrobat import AcrobatError, AcrobatSession
from .core import FAILED_STATUSES, PdfStats, TARGET_RULES, summarize_statuses
from .report import AccessibilityReport, parse_report

DEFAULT_DOWNLOADS = Path.home() / "Downloads"
SUPPORTED_PATTERNS = ("*.pdf",)


def _collect_files(targets: list[Path]) -> list[Path]:
    files: list[Path] = []
    for target in targets:
        if target.is_file() and target.suffix.lower() == ".pdf":
            files.append(target)
            continue
        if not target.is_dir():
            continue
        for pattern in SUPPORTED_PATTERNS:
            files.extend(
                p
                for p in target.glob(pattern)
                if p.is_file() and not p.name.startswith("~$")
            )
    return sorted({path.resolve() for path in files})


def _stage_path(path: Path, label: str) -> Path:
    return path.with_name(f"{path.stem}.__ecclesqa_{label}{path.suffix}")


def _needs_status(report: AccessibilityReport | None, rule_name: str) -> bool:
    return report is not None and report.status(rule_name) in FAILED_STATUSES


def _interesting(report: AccessibilityReport | None) -> str:
    if report is None:
        return "report unavailable"
    return summarize_statuses(report.interesting_statuses(TARGET_RULES))


def process_pdf(path: Path) -> None:
    print(f"\n{'=' * 60}")
    print(f"File: {path.name}")

    stats = PdfStats()
    work_path = _stage_path(path, "work")
    retag_path = _stage_path(path, "retag")
    acrobat_path = _stage_path(path, "acrobat")
    meta_path = _stage_path(path, "meta")
    final_path = _stage_path(path, "final")

    for temp_path in (work_path, retag_path, acrobat_path, meta_path, final_path):
        temp_path.unlink(missing_ok=True)

    success = False
    try:
        security.prepare_working_copy(path, work_path, stats)
        if stats.security_removed:
            print("  --> Removed blank-password / restrictions-only security in a working copy.")

        before: AccessibilityReport | None = None
        try:
            with AcrobatSession() as acrobat:
                stats.before_report = acrobat.run_accessibility_check(work_path)
            before = parse_report(stats.before_report)
            print("  Before: " + _interesting(before))
        except AcrobatError as exc:
            print(f"  Before check unavailable: {exc}")

        needs_ocr = _needs_status(before, "Image-only PDF")
        needs_tagging = (
            needs_ocr
            or _needs_status(before, "Tagged PDF")
            or _needs_status(before, "Tagged content")
            or _needs_status(before, "Title")
            or _needs_status(before, "Figures alternate text")
            or _needs_status(before, "Other elements alternate text")
            or _needs_status(before, "Primary language")
        )
        prefer_ui_autotag = (
            before is not None
            and before.status("Tagged PDF") == "Passed"
            and needs_tagging
            and before.status("Tagged content") != "Failed"
        )
        needs_structure_reset = (
            before is not None
            and before.status("Tagged PDF") == "Passed"
            and before.status("Tagged content") == "Failed"
        )

        acrobat_input_path = work_path
        if needs_structure_reset:
            structure.strip_tags(work_path, retag_path, stats)
            acrobat_input_path = retag_path
            print("  --> Reset existing structure before Acrobat retagging.")

        if needs_tagging:
            with AcrobatSession() as acrobat:
                acrobat.open_document(acrobat_input_path)
                if needs_ocr:
                    wait_seconds = acrobat.perform_ocr(acrobat_input_path)
                    stats.ocr_applied = True
                    print(f"  --> OCR triggered in Acrobat ({wait_seconds}s wait).")
                tagged_probe = acrobat.make_accessible_and_wait(
                    acrobat_input_path,
                    acrobat_path,
                    prefer_ui=prefer_ui_autotag,
                )
                stats.autotag_applied = True
                print("  --> Acrobat autotagging persisted to a tagged snapshot.")
            shutil.copy2(tagged_probe, acrobat_path)
        else:
            shutil.copy2(work_path, acrobat_path)
            print("  --> Skipped Acrobat remediation (no targeted failures detected).")

        title = metadata.run(acrobat_path, meta_path, stats)
        print(f"  --> Title after metadata step: {title}")

        alttext_local.run(meta_path, final_path, stats)
        print(
            "  --> Alt text: "
            f"figures={stats.figure_tags_seen}  "
            f"generated={stats.alt_generated}  "
            f"present={stats.alt_already_present}  "
            f"fallback={stats.alt_fallback}"
        )

        shutil.copy2(final_path, path)
        print(f"  --> Saved: {path.name}")

        after: AccessibilityReport | None = None
        try:
            with AcrobatSession() as acrobat:
                stats.after_report = acrobat.run_accessibility_check(path)
            after = parse_report(stats.after_report)
            print("  After:  " + _interesting(after))
        except AcrobatError as exc:
            print(f"  After check unavailable: {exc}")

        _print_stats(stats, before, after)
        success = True

    finally:
        if success:
            for probe in path.parent.glob(f"{acrobat_path.stem}.poll*{acrobat_path.suffix}"):
                probe.unlink(missing_ok=True)
            for temp_path in (work_path, retag_path, acrobat_path, meta_path, final_path):
                temp_path.unlink(missing_ok=True)
        else:
            print("  --> Preserved intermediate files for debugging:")
            for temp_path in (work_path, retag_path, acrobat_path, meta_path, final_path):
                if temp_path.exists():
                    print(f"     {temp_path}")
            for probe in path.parent.glob(f"{acrobat_path.stem}.poll*{acrobat_path.suffix}"):
                print(f"     {probe}")


def _print_stats(stats: PdfStats, before: AccessibilityReport | None, after: AccessibilityReport | None) -> None:
    lines: list[str] = []
    if stats.security_removed:
        lines.append("security removed")
    if stats.structure_reset:
        lines.append("structure reset")
    if stats.ocr_applied:
        lines.append("OCR applied")
    if stats.autotag_applied:
        lines.append("autotag applied")
    if stats.title_updated:
        lines.append("title normalized")
    if stats.lang_set:
        lines.append("language set")
    if stats.display_title_set:
        lines.append("display title enabled")
    if stats.alt_generated:
        lines.append(f"{stats.alt_generated} alt text(s) generated")
    if stats.alt_already_present:
        lines.append(f"{stats.alt_already_present} figure(s) already had alt text")
    if stats.alt_fallback:
        lines.append(f"{stats.alt_fallback} fallback alt text(s)")
    if lines:
        print("  Summary: " + " | ".join(lines))

    if before is not None and after is not None:
        targeted = []
        for rule_name in TARGET_RULES:
            before_status = before.status(rule_name)
            after_status = after.status(rule_name)
            if before_status == "Unknown" and after_status == "Unknown":
                continue
            targeted.append(f"{rule_name}: {before_status} -> {after_status}")
        if targeted:
            print("  Checker diff:")
            for line in targeted:
                print(f"    - {line}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Acrobat-backed PDF accessibility remediation."
    )
    parser.add_argument(
        "targets",
        nargs="*",
        type=Path,
        default=[DEFAULT_DOWNLOADS],
        help="PDF file(s) or folder(s) to process (default: ~/Downloads)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    files = _collect_files(args.targets)
    if not files:
        print("No PDF files found.")
        return 0

    print("==========================================")
    print("  PDF Accessibility Cleanup")
    print(f"  Targets: {len(files)} file(s)")
    print("==========================================")

    failures = 0
    for index, path in enumerate(files, start=1):
        print(f"\n[{index}/{len(files)}]")
        try:
            process_pdf(path)
        except Exception as exc:
            failures += 1
            print(f"  FAILED: {exc}")

    print("\n==========================================")
    print(f"  Done - {len(files)} file(s), {failures} failure(s)")
    print("==========================================")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
