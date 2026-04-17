"""Module: generate alt text locally using BLIP base (Salesforce/blip-image-captioning-base).

No Word AI or internet connection required. Sets AlternativeText directly via COM —
no UI interaction needed. Images are extracted from the clipboard per shape for
accurate 1-to-1 mapping.

The model is lazy-loaded on first use and stays resident for subsequent documents.

Expected context keys
---------------------
(none beyond the standard doc/stats/ctx signature — does not need ctx["window"])
"""
from __future__ import annotations

import time
from typing import TYPE_CHECKING

from .core import DocumentStats, summarize, strip_ai_footer
from .alttext_word_cloud import collect_shapes

if TYPE_CHECKING:
    from PIL import Image as PilImage

LABEL = "Alt text (local BLIP)"

MAX_NEW_TOKENS = 15  # ~10 words

# ── Lazy model singleton ──────────────────────────────────────────────────────

_processor = None
_model = None
_device = None


def _load_model():
    global _processor, _model, _device
    if _model is not None:
        return

    import torch
    from transformers import BlipForConditionalGeneration, BlipProcessor

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  --> Loading BLIP base on {_device} (first run only)...")

    _processor = BlipProcessor.from_pretrained(
        "Salesforce/blip-image-captioning-base"
    )
    _model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-base",
        torch_dtype=__import__("torch").float16 if _device == "cuda" else __import__("torch").float32,
    ).to(_device)
    _model.eval()


# ── Image extraction ──────────────────────────────────────────────────────────

def _shape_to_pil(kind: str, shape) -> "PilImage | None":
    """Copy a COM shape to the clipboard and grab it as a PIL image."""
    from PIL import ImageGrab

    try:
        if kind == "inline":
            shape.Range.CopyAsPicture()
        else:
            shape.Copy()
        time.sleep(0.05)
        img = ImageGrab.grabclipboard()
        if img is not None:
            return img.convert("RGB")
    except Exception:
        pass
    return None


# ── Inference ─────────────────────────────────────────────────────────────────

def _caption_batch(images: list) -> list[str]:
    """Run BLIP on a list of PIL images, return captions in the same order."""
    import torch

    inputs = _processor(images=images, return_tensors="pt").to(_device)
    with torch.inference_mode():
        out = _model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS)
    return _processor.batch_decode(out, skip_special_tokens=True)


# ── Alt-text processing ───────────────────────────────────────────────────────

def _process_alt_text(shapes: list, stats: DocumentStats) -> None:
    if not shapes:
        print("  --> No images found.")
        return

    _load_model()

    # Separate shapes that already have alt text from those that need generation
    to_caption: list[tuple[int, str, object, "PilImage"]] = []

    for i, (kind, shape) in enumerate(shapes):
        stats.visuals_seen += 1
        current = strip_ai_footer((shape.AlternativeText or "").strip())
        if current:
            stats.alt_already_present += 1
            print(f"    [{kind} {i+1}/{len(shapes)}] Already present: \"{summarize(current)}\"")
            continue

        img = _shape_to_pil(kind, shape)
        if img is None:
            print(f"    [{kind} {i+1}/{len(shapes)}] Could not extract image — skipping.")
            continue
        to_caption.append((i, kind, shape, img))

    if not to_caption:
        return

    print(f"  --> Running BLIP on {len(to_caption)} image(s)...")
    captions = _caption_batch([entry[3] for entry in to_caption])

    for (i, kind, shape, _), caption in zip(to_caption, captions):
        label = f"{kind} {i+1}/{len(shapes)}"
        caption = caption.strip()
        if caption:
            shape.AlternativeText = caption
            stats.alt_generated += 1
            print(f"    [{label}] Generated: \"{summarize(caption)}\"")
        else:
            print(f"    [{label}] Empty caption — skipping.")


# ── Public module interface ───────────────────────────────────────────────────

def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    shapes = collect_shapes(doc)
    print(f"  --> {len(shapes)} image(s) found.")
    _process_alt_text(shapes, stats)
