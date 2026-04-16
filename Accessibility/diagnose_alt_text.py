"""
Diagnostic script for Word's GenerateAltText command.

Goal: figure out why some images get alt text generated and others don't.

For each InlineShape, captures:
  - Display dimensions (points)
  - True pixel dimensions of the underlying image
  - Image file format (PNG, JPEG, etc.)
  - Image file size in bytes
  - Color mode / channels
  - Aspect ratio
  - Whether alt text already existed
  - Whether generation succeeded
  - Time taken for generation
  - Resulting alt text (if any)
  - Exact error (if any)

Outputs:
  - diagnosis.csv — one row per shape, sortable
  - extracted_images/ — every image saved to disk with idx in filename,
    so you can eyeball failures vs successes
  - summary.txt — aggregate stats to spot patterns

Usage:
  python diagnose_alt_text.py "C:\\path\\to\\your.docx"
"""

import csv
import io
import os
import sys
import time
import traceback
import zipfile
from pathlib import Path

import win32com.client
from PIL import Image
from docx import Document
from docx.oxml.ns import qn


# ---------- Phase 1: extract every image from the docx (via zip) ----------

def extract_images_with_docx(docx_path, out_dir):
    """
    Walk the docx with python-docx to map InlineShape index -> image bytes.
    We need this because win32com doesn't expose raw image bytes easily.

    Returns a list of dicts in the SAME ORDER as Word's InlineShapes collection,
    containing:
      - rId
      - content_type (e.g. 'image/png')
      - image_bytes
      - pil_info: dict with format, size (w,h), mode
      - file_size
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = Document(docx_path)
    results = []

    for idx, shape in enumerate(doc.inline_shapes):
        entry = {"idx": idx}
        try:
            blip = (
                shape._inline.graphic.graphicData
                .find(qn("pic:pic"))
                .find(qn("pic:blipFill"))
                .find(qn("a:blip"))
            )
            rId = blip.get(qn("r:embed"))
            entry["rId"] = rId

            image_part = doc.part.rels[rId].target_part
            image_bytes = image_part.blob
            entry["content_type"] = image_part.content_type
            entry["file_size_bytes"] = len(image_bytes)

            # Use PIL to get real pixel dimensions and format
            try:
                with Image.open(io.BytesIO(image_bytes)) as im:
                    entry["pil_format"] = im.format
                    entry["pil_width_px"] = im.size[0]
                    entry["pil_height_px"] = im.size[1]
                    entry["pil_mode"] = im.mode  # 'RGB', 'RGBA', 'P', 'L', 'CMYK'...
                    entry["pil_megapixels"] = (im.size[0] * im.size[1]) / 1_000_000
                    entry["pil_aspect_ratio"] = im.size[0] / im.size[1] if im.size[1] else 0
            except Exception as e:
                entry["pil_error"] = f"{type(e).__name__}: {e}"

            # Save image to disk for eyeballing
            ext = entry.get("pil_format", "bin").lower()
            if ext == "jpeg":
                ext = "jpg"
            fname = out_dir / f"shape_{idx:03d}.{ext}"
            fname.write_bytes(image_bytes)
            entry["saved_path"] = str(fname)

        except Exception as e:
            entry["extract_error"] = f"{type(e).__name__}: {e}"
            entry["extract_traceback"] = traceback.format_exc()

        results.append(entry)

    return results


# ---------- Phase 2: drive Word and attempt generation per shape ----------

def try_generate_alt(word, shape, timeout=30, settle_before=0.5, settle_after=1.0):
    """
    Attempt to generate alt text for a single shape.
    Returns dict with: status, alt_text_before, alt_text_after,
                       time_to_populate, error, error_hresult.
    """
    result = {
        "status": None,
        "alt_text_before": None,
        "alt_text_after": None,
        "time_to_populate_s": None,
        "error": None,
        "error_hresult": None,
        "error_hresult_hex": None,
    }

    try:
        before = shape.AlternativeText or ""
        result["alt_text_before"] = before
    except Exception as e:
        result["error"] = f"read_before_failed: {e}"
        result["status"] = "read_error"
        return result

    # Select the shape
    try:
        shape.Select()
    except Exception as e:
        result["error"] = f"select_failed: {e}"
        result["status"] = "select_error"
        return result

    time.sleep(settle_before)

    # Fire the command
    exec_start = time.time()
    try:
        word.CommandBars.ExecuteMso("GenerateAltText")
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        result["status"] = "execute_mso_error"
        # Try to extract HRESULT
        if hasattr(e, "args") and len(e.args) >= 1 and isinstance(e.args[0], int):
            hr = e.args[0]
            result["error_hresult"] = hr
            result["error_hresult_hex"] = f"0x{hr & 0xFFFFFFFF:08X}"
        # Also check for the inner excepinfo (args[2] is often the COM excepinfo tuple)
        if hasattr(e, "excepinfo") and e.excepinfo:
            try:
                scode = e.excepinfo[5]
                result["error_hresult_inner"] = scode
                result["error_hresult_inner_hex"] = f"0x{scode & 0xFFFFFFFF:08X}"
            except Exception:
                pass
        return result

    # Poll for alt text change
    poll_start = time.time()
    while time.time() - poll_start < timeout:
        try:
            current = shape.AlternativeText or ""
            if current and current != before:
                result["alt_text_after"] = current
                result["time_to_populate_s"] = round(time.time() - exec_start, 2)
                result["status"] = "ok"
                time.sleep(settle_after)
                return result
        except Exception as e:
            result["error"] = f"poll_failed: {e}"
            result["status"] = "poll_error"
            return result
        time.sleep(0.3)

    result["status"] = "timeout"
    result["alt_text_after"] = shape.AlternativeText or ""
    return result


# ---------- Phase 3: orchestrate ----------

def run_diagnosis(docx_path):
    docx_path = Path(docx_path).resolve()
    assert docx_path.exists(), f"File not found: {docx_path}"

    work_dir = docx_path.parent / f"{docx_path.stem}_diagnosis"
    work_dir.mkdir(exist_ok=True)
    images_dir = work_dir / "extracted_images"

    print(f"[1/3] Extracting images via python-docx...")
    image_info = extract_images_with_docx(str(docx_path), images_dir)
    print(f"      Found {len(image_info)} inline shapes. Saved to {images_dir}")

    print(f"[2/3] Opening Word and attempting generation per shape...")
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = True  # visible is more reliable for this command
    doc = word.Documents.Open(str(docx_path))

    rows = []
    try:
        inline_shapes = doc.InlineShapes
        count = inline_shapes.Count
        print(f"      Word reports {count} inline shapes.")

        for i in range(1, count + 1):  # Word collections are 1-indexed
            shape = inline_shapes(i)
            idx = i - 1

            # Pull display-side info from Word
            display_info = {
                "word_idx": idx,
                "word_type": None,
                "word_width_pts": None,
                "word_height_pts": None,
                "word_has_alt_title": None,
                "word_has_alt_desc": None,
            }
            try:
                display_info["word_type"] = shape.Type
                display_info["word_width_pts"] = round(shape.Width, 2)
                display_info["word_height_pts"] = round(shape.Height, 2)
                display_info["word_has_alt_title"] = bool(shape.Title)
                display_info["word_has_alt_desc"] = bool(shape.AlternativeText)
            except Exception as e:
                display_info["word_info_error"] = str(e)

            # Try generation
            print(f"      [{idx}] trying...", end=" ", flush=True)
            gen_result = try_generate_alt(word, shape)
            print(gen_result["status"])

            # Merge: extraction info + display info + generation result
            extract_info = image_info[idx] if idx < len(image_info) else {}
            row = {}
            row.update(extract_info)
            row.update(display_info)
            row.update({f"gen_{k}": v for k, v in gen_result.items()})
            rows.append(row)

    finally:
        # Don't save — we're just diagnosing
        doc.Close(SaveChanges=False)
        word.Quit()

    print(f"[3/3] Writing results...")

    # Write CSV
    csv_path = work_dir / "diagnosis.csv"
    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    # Put key columns first for readability
    priority = [
        "idx", "gen_status", "gen_alt_text_after",
        "pil_format", "pil_width_px", "pil_height_px", "pil_megapixels",
        "pil_mode", "file_size_bytes", "pil_aspect_ratio",
        "word_width_pts", "word_height_pts",
        "gen_time_to_populate_s",
        "gen_error", "gen_error_hresult_hex", "gen_error_hresult_inner_hex",
        "content_type", "saved_path",
    ]
    ordered = [k for k in priority if k in all_keys] + sorted(all_keys - set(priority))

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ordered, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    print(f"      CSV: {csv_path}")

    # Write summary
    summary_path = work_dir / "summary.txt"
    write_summary(rows, summary_path)
    print(f"      Summary: {summary_path}")

    return rows


def write_summary(rows, path):
    """Aggregate stats — what correlates with success vs failure?"""
    ok = [r for r in rows if r.get("gen_status") == "ok"]
    fail = [r for r in rows if r.get("gen_status") != "ok"]

    def stats(group, key):
        vals = [r.get(key) for r in group if isinstance(r.get(key), (int, float))]
        if not vals:
            return "n/a"
        return f"min={min(vals):.1f} max={max(vals):.1f} avg={sum(vals)/len(vals):.1f}"

    def format_counts(group, key):
        from collections import Counter
        c = Counter(r.get(key) for r in group)
        return ", ".join(f"{k}={v}" for k, v in c.most_common())

    lines = []
    lines.append("=" * 70)
    lines.append(f"Total shapes: {len(rows)}")
    lines.append(f"Succeeded:    {len(ok)}")
    lines.append(f"Failed:       {len(fail)}")
    lines.append("")
    lines.append("--- STATUS BREAKDOWN ---")
    lines.append(format_counts(rows, "gen_status"))
    lines.append("")
    lines.append("--- FAILURES BY HRESULT ---")
    lines.append(format_counts(fail, "gen_error_hresult_hex"))
    lines.append(format_counts(fail, "gen_error_hresult_inner_hex"))
    lines.append("")
    lines.append("--- SUCCESS GROUP ---")
    lines.append(f"  pixel width:    {stats(ok, 'pil_width_px')}")
    lines.append(f"  pixel height:   {stats(ok, 'pil_height_px')}")
    lines.append(f"  megapixels:     {stats(ok, 'pil_megapixels')}")
    lines.append(f"  file size (B):  {stats(ok, 'file_size_bytes')}")
    lines.append(f"  aspect ratio:   {stats(ok, 'pil_aspect_ratio')}")
    lines.append(f"  formats:        {format_counts(ok, 'pil_format')}")
    lines.append(f"  color modes:    {format_counts(ok, 'pil_mode')}")
    lines.append("")
    lines.append("--- FAILURE GROUP ---")
    lines.append(f"  pixel width:    {stats(fail, 'pil_width_px')}")
    lines.append(f"  pixel height:   {stats(fail, 'pil_height_px')}")
    lines.append(f"  megapixels:     {stats(fail, 'pil_megapixels')}")
    lines.append(f"  file size (B):  {stats(fail, 'file_size_bytes')}")
    lines.append(f"  aspect ratio:   {stats(fail, 'pil_aspect_ratio')}")
    lines.append(f"  formats:        {format_counts(fail, 'pil_format')}")
    lines.append(f"  color modes:    {format_counts(fail, 'pil_mode')}")
    lines.append("")
    lines.append("--- HYPOTHESIS CHECKS ---")

    # Hypothesis: pixel dimension limit
    ok_max_dim = max(
        (max(r.get("pil_width_px", 0), r.get("pil_height_px", 0)) for r in ok),
        default=0,
    )
    fail_min_dim = min(
        (max(r.get("pil_width_px", 0), r.get("pil_height_px", 0)) for r in fail if r.get("pil_width_px")),
        default=0,
    )
    lines.append(f"  Largest dim in SUCCESS: {ok_max_dim}px")
    lines.append(f"  Smallest largest-dim in FAILURE: {fail_min_dim}px")
    if ok_max_dim and fail_min_dim and fail_min_dim > ok_max_dim:
        lines.append("  => Possible pixel-size ceiling between these values")

    # Hypothesis: file size limit
    ok_max_size = max((r.get("file_size_bytes", 0) for r in ok), default=0)
    fail_min_size = min(
        (r.get("file_size_bytes", 0) for r in fail if r.get("file_size_bytes")),
        default=0,
    )
    lines.append(f"  Largest file in SUCCESS: {ok_max_size} bytes")
    lines.append(f"  Smallest file in FAILURE: {fail_min_size} bytes")

    # Hypothesis: aspect ratio
    ok_ars = [r.get("pil_aspect_ratio", 1) for r in ok if r.get("pil_aspect_ratio")]
    fail_ars = [r.get("pil_aspect_ratio", 1) for r in fail if r.get("pil_aspect_ratio")]
    if ok_ars and fail_ars:
        extreme_fail_ars = [a for a in fail_ars if a > 5 or a < 0.2]
        extreme_ok_ars = [a for a in ok_ars if a > 5 or a < 0.2]
        lines.append(f"  Extreme aspect ratios (>5:1 or <1:5) in FAILURE: {len(extreme_fail_ars)}/{len(fail_ars)}")
        lines.append(f"  Extreme aspect ratios in SUCCESS: {len(extreme_ok_ars)}/{len(ok_ars)}")

    lines.append("")
    lines.append("--- FAILED SHAPE DETAILS ---")
    for r in fail:
        lines.append(
            f"  [{r.get('idx')}] {r.get('pil_format')} "
            f"{r.get('pil_width_px')}x{r.get('pil_height_px')}px "
            f"{r.get('file_size_bytes')}B "
            f"mode={r.get('pil_mode')} "
            f"status={r.get('gen_status')} "
            f"err={r.get('gen_error_hresult_hex')}"
        )

    path.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python diagnose_alt_text.py <path-to-docx>")
        sys.exit(1)
    run_diagnosis(sys.argv[1])