"""Module: generate alt text locally using BLIP large.

Works directly on the .docx file — no Word, no COM, no UI automation.
BLIP large gives fast, gist-level captions on CPU (typically 2-5s per image)
with no chat-template overhead. Images are read from the document's relationship
parts and alt text is written straight to the XML.

The model is lazy-loaded on the first document that has images needing alt text,
then reused for all subsequent documents.

Pip dependencies:
    pip install transformers torch Pillow python-docx
"""
from __future__ import annotations

import io
import time

from docx.oxml.ns import qn

# VML namespace not in python-docx's qn map — define manually
_V_SHAPE     = "{urn:schemas-microsoft-com:vml}shape"
_V_IMAGEDATA = "{urn:schemas-microsoft-com:vml}imagedata"
_R_ID        = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

from .core import DocumentStats, summarize, strip_ai_footer

LABEL = "Alt text (local BLIP large)"

_MODEL_ID       = "Salesforce/blip-image-captioning-large"
_MAX_NEW_TOKENS = 35

# ── Lazy model singleton ──────────────────────────────────────────────────────

_processor = None
_model     = None
_device    = None


def _load_model() -> None:
    global _processor, _model, _device
    if _model is not None:
        return

    import torch
    from transformers import BlipForConditionalGeneration, BlipProcessor

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  --> Initializing BLIP large on {_device} (first run only, ~900MB download)...")

    _processor = BlipProcessor.from_pretrained(_MODEL_ID)
    _model = BlipForConditionalGeneration.from_pretrained(
        _MODEL_ID,
        torch_dtype=torch.float16 if _device == "cuda" else torch.float32,
    ).to(_device)
    _model.eval()
    print("  --> Model ready.")


# ── Shape collection ──────────────────────────────────────────────────────────
# Tuples: (kind, element, alt_attr, image_bytes)
#   DrawingML → (wp:docPr element, "descr")
#   VML       → (v:shape element,  "alt")

def _collect_image_shapes(doc) -> list[tuple]:
    """Return [(kind, element, alt_attr, image_bytes), ...] for every image.

    Iterates all wp:docPr elements in the body (covers inline, floating, text
    boxes, mc:AlternateContent, etc.) then all VML v:shape elements.
    Relationship IDs are deduplicated so the same image is never processed twice.
    """
    shapes    = []
    seen_rids: set[str] = set()

    # DrawingML — any wp:docPr anywhere in the body ────────────────────────────
    for docPr in doc.element.body.iter(qn("wp:docPr")):
        try:
            blip = docPr.getparent().find(".//" + qn("a:blip"))
            if blip is None:
                continue
            rId = blip.get(qn("r:embed"))
            if not rId or rId in seen_rids:
                continue
            seen_rids.add(rId)
            shapes.append(("drawingml", docPr, "descr", doc.part.related_parts[rId].blob))
        except Exception:
            continue

    # VML — v:shape with v:imagedata anywhere in the body ─────────────────────
    for vshape in doc.element.body.iter(_V_SHAPE):
        try:
            imagedata = vshape.find(_V_IMAGEDATA)
            if imagedata is None:
                continue
            rId = imagedata.get(_R_ID)
            if not rId or rId in seen_rids:
                continue
            seen_rids.add(rId)
            shapes.append(("vml", vshape, "alt", doc.part.related_parts[rId].blob))
        except Exception:
            continue

    return shapes


# ── Inference ─────────────────────────────────────────────────────────────────

def _caption_one(pil_image) -> str:
    import torch

    inputs = _processor(images=pil_image, return_tensors="pt").to(_device)
    with torch.inference_mode():
        out = _model.generate(
            **inputs,
            max_new_tokens=_MAX_NEW_TOKENS,
            num_beams=1,          # greedy — fastest, still good enough for gist
            repetition_penalty=1.3,
        )
    return _processor.decode(out[0], skip_special_tokens=True).strip()


# ── Alt-text processing ───────────────────────────────────────────────────────

def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    from PIL import Image

    shapes = _collect_image_shapes(doc)
    print(f"  --> {len(shapes)} image(s) found.")
    if not shapes:
        return

    # First pass: triage what already has alt text and what needs captioning
    to_caption: list[tuple] = []

    for i, (kind, element, alt_attr, image_bytes) in enumerate(shapes):
        label = f"{kind} {i + 1}/{len(shapes)}"
        stats.visuals_seen += 1

        current = strip_ai_footer((element.get(alt_attr) or "").strip())
        if current:
            stats.alt_already_present += 1
            print(f"    [{label}] Already present: \"{summarize(current)}\"")
            continue

        try:
            pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception:
            print(f"    [{label}] Unsupported image format — skipping.")
            continue

        to_caption.append((i, label, element, alt_attr, pil))

    if not to_caption:
        print("  --> Skipped (all images already have alt text).")
        return

    # Load model now that we know images actually need captioning
    print(f"  --> {len(to_caption)} image(s) need alt text — initializing model...")
    _load_model()

    print(f"  --> Running BLIP large on {len(to_caption)} image(s)...")
    elapsed_times: list[float] = []

    for idx, (i, label, element, alt_attr, pil) in enumerate(to_caption, 1):
        print(f"    [{label}] ({idx}/{len(to_caption)}) generating...", end=" ", flush=True)
        t0 = time.perf_counter()
        try:
            caption = _caption_one(pil).strip()
        except Exception as exc:
            print(f"ERROR: {exc}")
            continue
        elapsed = time.perf_counter() - t0
        elapsed_times.append(elapsed)

        if caption:
            element.set(alt_attr, caption)
            stats.alt_generated += 1
            print(f"{elapsed:.1f}s — \"{summarize(caption)}\"")
        else:
            print(f"{elapsed:.1f}s — empty, skipping.")

    if elapsed_times:
        total = sum(elapsed_times)
        print(
            f"  --> Timing: min={min(elapsed_times):.1f}s  "
            f"max={max(elapsed_times):.1f}s  "
            f"avg={total / len(elapsed_times):.1f}s  "
            f"total={total:.0f}s"
        )
