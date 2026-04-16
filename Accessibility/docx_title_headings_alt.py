from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

try:
    import pythoncom
    import win32com.client
except ImportError as exc:
    print(f"ERROR: pywin32 is required. Install with: python -m pip install pywin32\n{exc}", file=sys.stderr)
    sys.exit(1)


DEFAULT_DOWNLOADS = Path(r"C:\Users\u1592528\Downloads")
SUPPORTED_PATTERNS = ("*.docx", "*.docm", "*.doc")

WD_STYLE_HEADING_1 = -2
WD_STYLE_HEADING_2 = -3

MsoPictureTypes = {11, 13, 28, 29}
WdInlineVisualTypes = {1, 2, 3, 4, 5, 8, 9, 10, 11}

ALT_TEXT_POLL_INTERVAL = 0.5
ALT_TEXT_TIMEOUT = 30
ALT_TEXT_MAX_ATTEMPTS = 3

AI_FOOTER_PATTERN = re.compile(
    r"\s*\n+\s*(?:description automatically generated"
    r"|ai[\s-]?generated content may be incorrect"
    r"|please (?:check|verify)(?: the)?(?: ai| auto(?:matically)?(?: generated)?)? alt text)"
    r"\.?\s*$",
    re.IGNORECASE,
)


@dataclass
class DocumentStats:
    title_updated: bool = False
    heading1_applied: bool = False
    heading2_applied: int = 0
    alt_generated: int = 0
    alt_decorative: int = 0
    alt_already_present: int = 0
    alt_cleaned: int = 0
    visuals_seen: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update Word document accessibility: title, headings, and image alt text."
    )
    parser.add_argument("--folder", type=Path, default=DEFAULT_DOWNLOADS)
    return parser.parse_args()


def iter_candidate_files(folder: Path) -> list[Path]:
    files: list[Path] = []
    for pattern in SUPPORTED_PATTERNS:
        files.extend(folder.glob(pattern))
    return sorted(p for p in files if p.is_file() and not p.name.startswith("~$"))


def clean_text(value: str) -> str:
    return " ".join(value.replace("\r", " ").replace("\x07", " ").split()).strip()


def summarize(value: str, max_length: int = 100) -> str:
    flat = " ".join(value.split())
    return flat if len(flat) <= max_length else flat[: max_length - 3] + "..."


def strip_ai_footer(text: str) -> str:
    return AI_FOOTER_PATTERN.sub("", text).strip()


def style_name(paragraph) -> str:
    try:
        style = paragraph.Range.Style
        return clean_text(getattr(style, "NameLocal", str(style)))
    except Exception:
        return ""


def is_heading_style(paragraph) -> bool:
    name = style_name(paragraph).lower().replace("-", " ")
    return "heading" in name or name.strip() == "title"


def paragraph_text(paragraph) -> str:
    return clean_text(paragraph.Range.Text)


def first_non_empty_paragraph(document):
    for p in document.Paragraphs:
        if paragraph_text(p):
            return p
    return None


def should_promote_to_heading2(text: str) -> bool:
    if not text or len(text) > 90:
        return False
    if "\t" in text or "," in text:
        return False
    if text.endswith((".", "!", "?", ";")):
        return False
    if re.match(r"^(\d+[\.\)]|[A-Za-z][\.\)]|[-*])\s+", text):
        return False
    word_count = len(text.split())
    if not 2 <= word_count <= 10:
        return False
    return text == text.title() or text.isupper() or len(text) <= 45


def try_generate_alt(word, shape, timeout: int = ALT_TEXT_TIMEOUT) -> tuple[str | None, str]:
    """Fire GenerateAltText and poll until alt text appears. Returns (text, status)."""
    before = shape.AlternativeText or ""
    try:
        shape.Select()
        time.sleep(0.5)  # let selection settle before dispatching
        word.CommandBars.ExecuteMso("GenerateAltText")
    except Exception as e:
        return None, f"execute_failed: {e}"

    start = time.time()
    while time.time() - start < timeout:
        current = shape.AlternativeText or ""
        if current and current != before:
            time.sleep(1.5)  # let Word finish internal bookkeeping before next call
            return current, "ok"
        time.sleep(ALT_TEXT_POLL_INTERVAL)

    time.sleep(2)  # settle even on timeout
    return None, "timeout"


def generate_alt_with_retry(word, shape, label: str) -> tuple[str | None, str]:
    """Retry try_generate_alt with exponential backoff on execute failures."""
    for attempt in range(ALT_TEXT_MAX_ATTEMPTS):
        text, status = try_generate_alt(word, shape)
        if text:
            return text, "ok"
        if status.startswith("execute_failed"):
            wait = 2 ** attempt  # 1s, 2s, 4s
            print(f"    [{label}] Attempt {attempt + 1} failed ({status}), retrying in {wait}s...")
            time.sleep(wait)
            continue
        if status == "timeout":
            return None, "timeout"
    return None, "exhausted_retries"


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
    word.Visible = True  # required for ExecuteMso to work
    print("Word is running.\n")

    failed = 0

    try:
        for index, path in enumerate(files, start=1):
            print(f"[{index}/{len(files)}] {path.name}")
            print("------------------------------------------")
            stats = DocumentStats()
            doc = None
            success = False

            try:
                doc = word.Documents.Open(str(path), ReadOnly=False, AddToRecentFiles=False)

                # ── Alt text ── (exact test_alt.py pattern, no extra sleeps)
                print("  [1/3] Alt text")
                inline_index = 0
                for shape in doc.InlineShapes:
                    if getattr(shape, "Type", None) not in WdInlineVisualTypes:
                        continue
                    inline_index += 1
                    stats.visuals_seen += 1
                    label = f"inline #{inline_index}"

                    current = (shape.AlternativeText or "").strip()
                    cleaned = strip_ai_footer(current)
                    if cleaned:
                        if cleaned != current:
                            shape.AlternativeText = cleaned
                            stats.alt_cleaned += 1
                            print(f"    [{label}] Cleaned footer -> \"{summarize(cleaned)}\"")
                        else:
                            stats.alt_already_present += 1
                            print(f"    [{label}] Already present: \"{summarize(cleaned)}\"")
                        continue

                    print(f"    [{label}] Generating...")
                    raw, status = generate_alt_with_retry(word, shape, label)
                    result = strip_ai_footer((raw or "").strip())
                    if result:
                        shape.AlternativeText = result
                        stats.alt_generated += 1
                        print(f"    [{label}] Generated: \"{summarize(result)}\"")
                    else:
                        shape.AlternativeText = ""
                        shape.Decorative = True
                        stats.alt_decorative += 1
                        print(f"    [{label}] {status} — marked decorative.")

                floating_index = 0
                for shape in doc.Shapes:
                    if getattr(shape, "Type", None) not in MsoPictureTypes:
                        continue
                    floating_index += 1
                    stats.visuals_seen += 1
                    label = f"floating #{floating_index}"

                    current = (shape.AlternativeText or "").strip()
                    cleaned = strip_ai_footer(current)
                    if cleaned:
                        if cleaned != current:
                            shape.AlternativeText = cleaned
                            stats.alt_cleaned += 1
                            print(f"    [{label}] Cleaned footer -> \"{summarize(cleaned)}\"")
                        else:
                            stats.alt_already_present += 1
                            print(f"    [{label}] Already present: \"{summarize(cleaned)}\"")
                        continue

                    print(f"    [{label}] Generating...")
                    raw, status = generate_alt_with_retry(word, shape, label)
                    result = strip_ai_footer((raw or "").strip())
                    if result:
                        shape.AlternativeText = result
                        stats.alt_generated += 1
                        print(f"    [{label}] Generated: \"{summarize(result)}\"")
                    else:
                        shape.AlternativeText = ""
                        shape.Decorative = True
                        stats.alt_decorative += 1
                        print(f"    [{label}] {status} — marked decorative.")

                if stats.visuals_seen == 0:
                    print("  --> No images found.")

                # ── Title metadata ─────────────────────────────────────────
                print("  [2/3] Title metadata")
                try:
                    current_title = str(doc.BuiltInDocumentProperties("Title").Value or "").strip()
                except Exception:
                    current_title = ""
                desired_title = path.stem
                if clean_text(current_title) != desired_title:
                    doc.BuiltInDocumentProperties("Title").Value = desired_title
                    stats.title_updated = True
                    print(f'  --> Updated: "{current_title}" -> "{desired_title}"')
                else:
                    print(f'  --> Already correct: "{desired_title}"')

                # ── Headings ───────────────────────────────────────────────
                print("  [3/3] Headings")
                first = first_non_empty_paragraph(doc)
                if first is None:
                    print("  --> Document empty, skipping.")
                else:
                    first_text = paragraph_text(first)
                    if not is_heading_style(first):
                        first.Range.Style = WD_STYLE_HEADING_1
                        stats.heading1_applied = True
                        print(f'  --> Heading 1: "{summarize(first_text)}"')
                    else:
                        print(f'  --> First paragraph already a heading: "{summarize(first_text)}"')

                    applied = 0
                    for p in doc.Paragraphs:
                        if p is first:
                            continue
                        text = paragraph_text(p)
                        if should_promote_to_heading2(text) and not is_heading_style(p):
                            p.Range.Style = WD_STYLE_HEADING_2
                            applied += 1
                            print(f'  --> Heading 2: "{summarize(text)}"')
                    stats.heading2_applied = applied
                    if not applied:
                        print("  --> No Heading 2 candidates.")

                success = True

            except Exception as exc:
                failed += 1
                print(f"  FAILED: {exc}")

            finally:
                if doc is not None:
                    if success:
                        doc.Save()
                        print("  Saved.")
                    else:
                        print("  Skipped save (error occurred).")
                    doc.Close(SaveChanges=False)

            print(f"  title={stats.title_updated}  h1={stats.heading1_applied}  h2={stats.heading2_applied}  "
                  f"visuals={stats.visuals_seen}  generated={stats.alt_generated}  "
                  f"decorative={stats.alt_decorative}  present={stats.alt_already_present}  "
                  f"cleaned={stats.alt_cleaned}")
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
