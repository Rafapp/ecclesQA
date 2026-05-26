"""Orchestrator for Adobe PDF Services-backed PDF accessibility remediation."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from Accessibility.pdf_local import alttext_local, metadata, security
from pypdf import PdfReader

from .config import CredentialsError, DEFAULT_CREDENTIALS_FILE, load_credentials
from .core import FAILED_STATUSES, PdfStats, TARGET_RULES, summarize_statuses
from .report import AccessibilityReport, parse_report
from .service import AdobePdfServicesClient, CloudPdfError
from Accessibility.manifest import JobManifest


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


def _stage_pdf_path(path: Path, label: str) -> Path:
    return path.with_name(f"{path.stem}.__ecclesqa_{label}{path.suffix}")


def _stage_asset_path(path: Path, label: str, suffix: str) -> Path:
    return path.with_name(f"{path.stem}.__ecclesqa_{label}{suffix}")


def _needs_status(report: AccessibilityReport | None, rule_name: str) -> bool:
    return report is not None and report.status(rule_name) in FAILED_STATUSES


def _interesting(report: AccessibilityReport | None) -> str:
    if report is None:
        return "report unavailable"
    return summarize_statuses(report.interesting_statuses(TARGET_RULES))


def _normalize_password_key(value: str) -> str:
    return value.strip().replace("/", "\\").lower()


def _password_key_forms_for_path(path: Path) -> set[str]:
    resolved = path.resolve()
    return {
        _normalize_password_key(str(path)),
        _normalize_password_key(str(resolved)),
        path.name.lower(),
        path.stem.lower(),
    }


def _password_key_forms(raw_key: str) -> set[str]:
    forms = {_normalize_password_key(raw_key), raw_key.strip().lower()}
    key_path = Path(raw_key)
    if key_path.suffix.lower() == ".pdf" or "\\" in raw_key or "/" in raw_key:
        try:
            forms.add(_normalize_password_key(str(key_path.expanduser().resolve())))
        except OSError:
            pass
        forms.add(key_path.name.lower())
        forms.add(key_path.stem.lower())
    return {form for form in forms if form}


def _load_password_map(raw_value: str | None) -> dict[str, str]:
    if not raw_value:
        return {}

    source_path = Path(raw_value)
    if source_path.exists():
        payload_text = source_path.read_text(encoding="utf-8")
    else:
        payload_text = raw_value

    payload = json.loads(payload_text)
    if not isinstance(payload, dict):
        raise ValueError("--password-map must be a JSON object or a path to a JSON object file.")

    resolved: dict[str, str] = {}
    for key, value in payload.items():
        if value is None:
            continue
        password = str(value)
        for candidate in _password_key_forms(str(key)):
            resolved[candidate] = password
    return resolved


def _lookup_password(password_map: dict[str, str], path: Path) -> str | None:
    for candidate in _password_key_forms_for_path(path):
        value = password_map.get(candidate)
        if value:
            return value
    return None


def _pdf_has_tags(path: Path) -> bool:
    try:
        reader = PdfReader(str(path), strict=False)
        root = reader.trailer["/Root"]
        mark_info = root.get("/MarkInfo")
        return (
            root.get("/StructTreeRoot") is not None
            and mark_info is not None
            and bool(mark_info.get("/Marked"))
        )
    except Exception:
        return False


def process_pdf(
    path: Path,
    client: AdobePdfServicesClient,
    password_map: dict[str, str],
    ocr_locale: str,
    manifest: JobManifest,
) -> None:
    print(f"\n{'=' * 60}")
    print(f"File: {path.name}")

    stats = PdfStats()
    work_path = _stage_pdf_path(path, "cloud_work")
    ocr_path = _stage_pdf_path(path, "cloud_ocr")
    tagged_path = _stage_pdf_path(path, "cloud_tagged")
    meta_path = _stage_pdf_path(path, "cloud_meta")
    final_path = _stage_pdf_path(path, "cloud_final")
    before_checker_pdf = _stage_pdf_path(path, "cloud_before_checker")
    after_checker_pdf = _stage_pdf_path(path, "cloud_after_checker")
    before_report_path = _stage_asset_path(path, "cloud_before_report", ".json")
    after_report_path = _stage_asset_path(path, "cloud_after_report", ".json")
    autotag_report_path = _stage_asset_path(path, "cloud_autotag_report", ".xlsx")

    temp_paths = (
        work_path,
        ocr_path,
        tagged_path,
        meta_path,
        final_path,
        before_checker_pdf,
        after_checker_pdf,
        before_report_path,
        after_report_path,
        autotag_report_path,
    )
    for temp_path in temp_paths:
        temp_path.unlink(missing_ok=True)

    success = False
    try:
        info = security.inspect_security(path)
        stats.encrypted_before = info.encrypted
        if not info.encrypted or info.blank_password_works:
            security.prepare_working_copy(path, work_path, stats)
            if stats.security_removed:
                print("  --> Removed blank-password / restrictions-only security in a working copy.")
        else:
            password = _lookup_password(password_map, path)
            if not password:
                raise RuntimeError(
                    "PDF is encrypted and needs an owner password for cloud remediation. "
                    "Provide it via --password-map."
                )
            client.remove_protection(path, work_path, password)
            stats.security_removed = True
            print("  --> Removed protection using Adobe PDF Services.")

        before: AccessibilityReport | None = None
        try:
            stats.before_report = client.check_accessibility(
                work_path,
                before_checker_pdf,
                before_report_path,
            ).report_path
            before = parse_report(stats.before_report)
            print("  Before: " + _interesting(before))
        except (CloudPdfError, OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"  Before check unavailable: {exc}")

        current_input = work_path
        needs_ocr = _needs_status(before, "Image-only PDF")
        needs_tagging = (
            not _pdf_has_tags(current_input)
            or needs_ocr
            or _needs_status(before, "Tagged PDF")
            or _needs_status(before, "Tagged content")
            or _needs_status(before, "Figures alternate text")
            or _needs_status(before, "Other elements alternate text")
        )

        if needs_ocr:
            client.ocr_pdf(current_input, ocr_path, locale=ocr_locale)
            current_input = ocr_path
            stats.ocr_applied = True
            print("  --> Cloud OCR generated a searchable text layer.")

        if needs_tagging:
            client.autotag_pdf(
                current_input,
                tagged_path,
                report_path=autotag_report_path,
            )
            current_input = tagged_path
            stats.autotag_applied = True
            print("  --> Cloud auto-tagging completed.")
        else:
            shutil.copy2(current_input, tagged_path)
            current_input = tagged_path
            print("  --> Skipped cloud auto-tagging (no targeted tagging failures detected).")

        title = metadata.run(current_input, meta_path, stats)
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
            stats.after_report = client.check_accessibility(
                path,
                after_checker_pdf,
                after_report_path,
            ).report_path
            after = parse_report(stats.after_report)
            print("  After:  " + _interesting(after))
        except (CloudPdfError, OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"  After check unavailable: {exc}")

        _print_stats(stats, before, after)
        success = True
        manifest.mark_done(path)
    except Exception as exc:
        manifest.mark_failed(path, str(exc))
        raise
    finally:
        if success:
            for temp_path in temp_paths:
                temp_path.unlink(missing_ok=True)
        else:
            print("  --> Preserved intermediate files for debugging:")
            for temp_path in temp_paths:
                if temp_path.exists():
                    print(f"     {temp_path}")


def _print_stats(
    stats: PdfStats,
    before: AccessibilityReport | None,
    after: AccessibilityReport | None,
) -> None:
    lines: list[str] = []
    if stats.security_removed:
        lines.append("security removed")
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
        description="Run Adobe PDF Services-backed PDF accessibility remediation."
    )
    parser.add_argument(
        "targets",
        nargs="*",
        type=Path,
        default=[DEFAULT_DOWNLOADS],
        help="PDF file(s) or folder(s) to process (default: ~/Downloads)",
    )
    parser.add_argument(
        "--credentials-file",
        type=Path,
        default=DEFAULT_CREDENTIALS_FILE,
        help=f"Adobe PDF Services credentials file (default: {DEFAULT_CREDENTIALS_FILE})",
    )
    parser.add_argument(
        "--password-map",
        help=(
            "JSON object or JSON file mapping filename/path/stem to owner password "
            "for protected PDFs."
        ),
    )
    parser.add_argument(
        "--ocr-locale",
        default="en-US",
        help="OCR locale passed to Adobe PDF Services (default: en-US).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    files = _collect_files(args.targets)
    if not files:
        print("No PDF files found.")
        return 0

    try:
        password_map = _load_password_map(args.password_map)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Invalid --password-map: {exc}")
        return 2

    try:
        credentials = load_credentials(args.credentials_file)
    except CredentialsError as exc:
        print(exc)
        return 1

    client = AdobePdfServicesClient(credentials)

    print("==========================================")
    print("  PDF Accessibility Cleanup (Cloud)")
    print(f"  Targets: {len(files)} file(s)")
    if credentials.source is not None:
        print(f"  Credentials: {credentials.source}")
    else:
        print("  Credentials: environment variables")
    print("==========================================")

    manifests: dict[Path, JobManifest] = {}
    # Track which folders have started pdf_cloud processing
    started_folders: set[Path] = set()

    failures = 0
    for index, path in enumerate(files, start=1):
        folder = path.parent
        if folder not in manifests:
            manifests[folder] = JobManifest.for_folder(folder)
            
            # Check if pdf_cloud is already complete for this folder
            if manifests[folder].is_filetype_complete("pdf_cloud"):
                print(f"\nFolder {folder.name}: PDF files have already been processed. Skipping.")
                continue
            
            # Mark pdf_cloud as started for this folder
            if folder not in started_folders:
                manifests[folder].mark_filetype_started("pdf_cloud")
                started_folders.add(folder)
        
        manifest = manifests[folder]

        print(f"\n[{index}/{len(files)}]")
        try:
            process_pdf(path, client, password_map, args.ocr_locale, manifest)
        except Exception as exc:
            failures += 1
            print(f"  FAILED: {exc}")

    print("\n==========================================")
    print(f"  Done - {len(files)} file(s), {failures} failure(s)")
    print("==========================================")
    
    # Mark pdf_cloud as complete for each folder with no failures
    if failures == 0:
        for folder, manifest in manifests.items():
            if folder in started_folders:
                manifest.mark_filetype_complete("pdf_cloud")
    
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
