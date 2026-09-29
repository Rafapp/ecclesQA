"""Orchestrator for Acrobat-backed PDF accessibility remediation."""
from __future__ import annotations

import argparse
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

from . import alttext_local, metadata, security, structure
from .acrobat import AcrobatError, AcrobatSession
from .core import FAILED_STATUSES, PdfStats, TARGET_RULES, summarize_statuses
from .report import AccessibilityReport, parse_report
from Accessibility.manifest import JobManifest

DEFAULT_DOWNLOADS = Path.home() / "Downloads"
SUPPORTED_PATTERNS = ("*.pdf",)
MAX_FILE_ATTEMPTS = 3
ATTEMPTS_BEFORE_DEFER = 2
FILE_ATTEMPT_TIMEOUT_SECONDS = 20 * 60
ACROBAT_CHECK_STALL_SECONDS = 3 * 60

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, OSError):
    pass


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
                if p.is_file()
                and not p.name.startswith("~$")
                and ".__ecclesqa_" not in p.name.lower()
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


def process_pdf(path: Path, manifest: JobManifest, force: bool = False) -> None:
    if not force and manifest.is_done(path):
        print(f"\n  [done] Skipping {path.name} (use --force to reprocess)")
        return

    print("\n" + "=" * 60)
    print(f"File: {path.name}")

    stats = PdfStats()
    work_path = _stage_path(path, "work")
    retag_path = _stage_path(path, "retag")
    acrobat_path = _stage_path(path, "acrobat")
    meta_path = _stage_path(path, "meta")
    final_path = _stage_path(path, "final")

    # Detect resume point from whichever stage output files still exist.
    resuming = any(p.exists() for p in (work_path, acrobat_path, meta_path, final_path))
    if resuming:
        if final_path.exists():
            print("  --> Resuming: alt-text complete, running after-check and finalizing.")
        elif meta_path.exists():
            print("  --> Resuming: metadata complete, running alt-text generation.")
        elif acrobat_path.exists():
            print("  --> Resuming: autotagging complete, running metadata step.")
        else:
            print("  --> Resuming: security complete, running accessibility check.")
    else:
        for temp_path in (work_path, retag_path, acrobat_path, meta_path, final_path):
            temp_path.unlink(missing_ok=True)

    success = False
    before: AccessibilityReport | None = None

    try:
        # Stage 1: security -> work_path
        if not work_path.exists():
            print("  --> Preparing a security-safe working copy...", flush=True)
            security.prepare_working_copy(path, work_path, stats)
            if stats.security_removed:
                print("  --> Removed blank-password / restrictions-only security in a working copy.")
            manifest.mark_stage(path, "security")

        # Stage 2: before-check + OCR/autotag -> acrobat_path
        # Skipped entirely when acrobat_path already exists from a previous run.
        if not acrobat_path.exists():
            try:
                print("  --> Running the initial Acrobat accessibility check...", flush=True)
                with AcrobatSession() as acrobat:
                    stats.before_report = acrobat.run_accessibility_check(work_path)
                before = parse_report(stats.before_report)
                print("  Before: " + _interesting(before))
            except AcrobatError as exc:
                print(f"  Before check unavailable: {exc}")
            manifest.mark_stage(path, "before_check")

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
                        print("  --> Applying OCR in Acrobat...", flush=True)
                        wait_seconds = acrobat.perform_ocr(acrobat_input_path)
                        stats.ocr_applied = True
                        print(f"  --> OCR triggered in Acrobat ({wait_seconds}s wait).")
                    print("  --> Applying Acrobat autotagging...", flush=True)
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
            manifest.mark_stage(path, "autotag")

        # Stage 3: metadata -> meta_path
        if not meta_path.exists():
            print("  --> Updating title and document metadata...", flush=True)
            title = metadata.run(acrobat_path, meta_path, stats)
            print(f"  --> Title after metadata step: {title}")
            manifest.mark_stage(path, "metadata")

        # Stage 4: alt text -> final_path
        if not final_path.exists():
            print("  --> Generating and checking figure alternate text...", flush=True)
            alttext_local.run(meta_path, final_path, stats)
            print(
                "  --> Alt text: "
                f"figures={stats.figure_tags_seen}  "
                f"generated={stats.alt_generated}  "
                f"present={stats.alt_already_present}  "
                f"fallback={stats.alt_fallback}"
            )
            manifest.mark_stage(path, "alttext")

        # Stage 5: finalize + after-check
        shutil.copy2(final_path, path)
        print(f"  --> Saved: {path.name}")

        after: AccessibilityReport | None = None
        try:
            print("  --> Running the final Acrobat accessibility check...", flush=True)
            with AcrobatSession() as acrobat:
                stats.after_report = acrobat.run_accessibility_check(path)
            after = parse_report(stats.after_report)
            print("  After:  " + _interesting(after))
        except AcrobatError as exc:
            print(f"  After check unavailable: {exc}")

        _print_stats(stats, before, after)
        manifest.mark_done(path)
        success = True

    except Exception as exc:
        manifest.mark_failed(path, str(exc))
        raise

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


def _print_stats(
    stats: PdfStats,
    before: AccessibilityReport | None,
    after: AccessibilityReport | None,
) -> None:
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
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reprocess files even if the manifest records them as already done.",
    )
    parser.add_argument(
        "--single-file",
        type=Path,
        help="Internal: remediate one file in an isolated worker process.",
    )
    return parser.parse_args(argv)


def _kill_acrobat_processes() -> None:
    subprocess.run(
        ["taskkill", "/IM", "Acrobat.exe", "/T", "/F"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _run_single_file(path: Path, force: bool) -> int:
    manifest = JobManifest.for_folder(path.parent)
    try:
        process_pdf(path, manifest, force=force)
        return 0
    except Exception as exc:
        print(f"  FAILED: {exc}", flush=True)
        return 1


def _run_file_attempt(path: Path, force: bool, attempt: int) -> tuple[bool, str]:
    command = [
        sys.executable,
        "-u",
        "-m",
        "Accessibility.pdf_local",
        "--single-file",
        str(path),
    ]
    if force:
        command.append("--force")

    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=os.environ.copy(),
    )
    assert process.stdout is not None
    output: queue.Queue[str | None] = queue.Queue()

    def read_output() -> None:
        for line in process.stdout:
            output.put(line)
        output.put(None)

    threading.Thread(target=read_output, daemon=True).start()
    deadline = time.monotonic() + FILE_ATTEMPT_TIMEOUT_SECONDS
    last_line = "worker exited without an error message"
    stream_closed = False
    check_last_activity: float | None = None
    while not stream_closed or process.poll() is None:
        try:
            line = output.get(timeout=0.5)
        except queue.Empty:
            line = ""
        if line is None:
            stream_closed = True
        elif line:
            print(line, end="", flush=True)
            last_line = line.strip()
            if "Running the initial Acrobat accessibility check" in line or "Running the final Acrobat accessibility check" in line:
                check_last_activity = time.monotonic()
            elif check_last_activity is not None:
                check_last_activity = time.monotonic()
        if process.poll() is not None and stream_closed:
            break
        if time.monotonic() >= deadline:
            print(
                f"  --> Attempt {attempt} exceeded the {FILE_ATTEMPT_TIMEOUT_SECONDS // 60}-minute limit.",
                flush=True,
            )
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            _kill_acrobat_processes()
            return False, "Acrobat worker timed out"
        if (
            check_last_activity is not None
            and time.monotonic() - check_last_activity >= ACROBAT_CHECK_STALL_SECONDS
        ):
            print(
                f"  --> Acrobat check produced no output for {ACROBAT_CHECK_STALL_SECONDS // 60} minutes.",
                flush=True,
            )
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            _kill_acrobat_processes()
            return False, "Acrobat accessibility check stopped producing progress"

    if process.returncode == 0:
        return True, ""
    _kill_acrobat_processes()
    return False, last_line


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.single_file is not None:
        return _run_single_file(args.single_file.resolve(), args.force)

    files = _collect_files(args.targets)
    if not files:
        print("No PDF files found.")
        return 0

    print("==========================================")
    print("  PDF Accessibility Cleanup")
    print(f"  Targets: {len(files)} file(s)")
    print("==========================================")

    manifests: dict[Path, JobManifest] = {}
    # Track which folders have started pdf_local processing
    started_folders: set[Path] = set()

    deferred: list[tuple[Path, JobManifest, str]] = []
    for index, path in enumerate(files, start=1):
        folder = path.parent
        if folder not in manifests:
            manifests[folder] = JobManifest.for_folder(folder)
            
            # Check if pdf_local is already complete for this folder
            if manifests[folder].is_filetype_complete("pdf_local"):
                print(f"\nFolder {folder.name}: PDF files have already been processed. Skipping.")
                continue
            
            # Mark pdf_local as started for this folder
            if folder not in started_folders:
                manifests[folder].mark_filetype_started("pdf_local")
                started_folders.add(folder)
        
        manifest = manifests[folder]

        print(f"\n[{index}/{len(files)}]")
        if manifest.is_done(path) and not args.force:
            print(f"  [done] Skipping {path.name} (use --force to reprocess)")
            continue

        recovered = False
        error = ""
        for attempt in range(1, ATTEMPTS_BEFORE_DEFER + 1):
            print(f"  --> Isolated Acrobat attempt {attempt}/{MAX_FILE_ATTEMPTS}.", flush=True)
            recovered, error = _run_file_attempt(path, args.force, attempt)
            if recovered:
                break
            manifest.mark_recovery_attempt(path, attempt, error, deferred=False)
            print("  --> Restarting Acrobat before retrying this file.", flush=True)
            _kill_acrobat_processes()
        if not recovered:
            manifest.mark_recovery_attempt(path, ATTEMPTS_BEFORE_DEFER, error, deferred=True)
            deferred.append((path, manifest, error))
            print("  --> Deferred after repeated Acrobat failures; continuing with the queue.", flush=True)

    failures = 0
    if deferred:
        print("\n==========================================")
        print("  Retrying deferred PDF files")
        print("==========================================")
    for path, manifest, previous_error in deferred:
        print(f"\n[final retry] {path.name}")
        recovered, error = _run_file_attempt(path, args.force, MAX_FILE_ATTEMPTS)
        if recovered:
            continue
        final_error = error or previous_error
        manifest.mark_failed(path, final_error)
        failures += 1
        _kill_acrobat_processes()
        print(f"  FAILED AFTER {MAX_FILE_ATTEMPTS} ATTEMPTS: {final_error}", flush=True)

    print("\n==========================================")
    print(f"  Done - {len(files)} file(s), {failures} failure(s)")
    print("==========================================")
    
    # Mark pdf_local as complete for each folder with no failures
    if failures == 0:
        for folder, manifest in manifests.items():
            if folder in started_folders:
                manifest.mark_filetype_complete("pdf_local")
    
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
