"""Module: generate alt text for images/OLE objects in a presentation using BLIP large (local)."""
from __future__ import annotations

import time
from io import BytesIO

from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.oxml.ns import qn

from .core import BOILERPLATE_ALT_PATTERN, PresentationStats, clean_text, strip_ai_footer

LABEL = "Alt text (local BLIP)"

_MAX_NEW_TOKENS = 50

_processor = None
_model = None
_device = None


def _load_model() -> None:
    global _processor, _model, _device
    if _model is not None:
        return
    import torch
    from transformers import BlipForConditionalGeneration, BlipProcessor

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  --> Loading BLIP large on {_device} ...")
    _processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    _model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-large"
    ).to(_device)
    _model.eval()


def _caption_one(image_bytes: bytes) -> str:
    import torch
    from PIL import Image

    pil = Image.open(BytesIO(image_bytes)).convert("RGB")
    inputs = _processor(images=pil, return_tensors="pt").to(_device)
    with torch.inference_mode():
        out = _model.generate(
            **inputs,
            max_new_tokens=_MAX_NEW_TOKENS,
            num_beams=1,
            repetition_penalty=1.3,
        )
    return _processor.decode(out[0], skip_special_tokens=True).strip()


def _ole_preview_bytes(element, slide_part) -> bytes | None:
    """Extract the raster preview image embedded inside an OLE object element."""
    try:
        blip = element.find(".//" + qn("a:blip"))
        if blip is None:
            return None
        rId = blip.get(qn("r:embed"))
        if not rId:
            return None
        return slide_part.related_part(rId).blob
    except Exception:
        return None


def _walk_shapes(shapes, slide_part, results: list) -> None:
    for shape in shapes:
        st = shape.shape_type
        if st == MSO_SHAPE_TYPE.GROUP:
            _walk_shapes(shape.shapes, slide_part, results)
        elif st == MSO_SHAPE_TYPE.PICTURE:
            try:
                cNvPr = shape._element.nvPicPr.cNvPr
                results.append(("picture", cNvPr, shape.image.blob))
            except Exception:
                pass
        elif st == MSO_SHAPE_TYPE.EMBEDDED_OLE_OBJECT:
            try:
                cNvPr = shape._element.nvGraphicFramePr.cNvPr
                image_bytes = _ole_preview_bytes(shape._element, slide_part)
                if image_bytes:
                    results.append(("ole", cNvPr, image_bytes))
            except Exception:
                pass


def _collect_visuals(slide) -> list[tuple]:
    results: list[tuple] = []
    _walk_shapes(slide.shapes, slide.part, results)
    return results


def run(prs, stats: PresentationStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    visuals: list[tuple] = []
    for slide in prs.slides:
        visuals.extend(_collect_visuals(slide))

    stats.visuals_seen += len(visuals)

    needs_caption: list[tuple] = []
    for kind, cNvPr, image_bytes in visuals:
        existing = strip_ai_footer(clean_text(cNvPr.get("descr") or ""))
        if existing and not BOILERPLATE_ALT_PATTERN.match(existing):
            stats.alt_already_present += 1
        elif existing:
            stats.alt_cleaned += 1
            needs_caption.append((kind, cNvPr, image_bytes))
        else:
            needs_caption.append((kind, cNvPr, image_bytes))

    if not needs_caption:
        print(
            f"  --> Skipped ({stats.alt_already_present} image(s) already have alt text)."
        )
        return

    if any(kind == "picture" for kind, *_ in needs_caption):
        _load_model()

    times: list[float] = []
    for i, (kind, cNvPr, image_bytes) in enumerate(needs_caption, 1):
        if kind == "ole":
            caption = "Mathematical equation"
            cNvPr.set("descr", caption)
            stats.alt_generated += 1
            print(f"  [{i}/{len(needs_caption)}] (equation) {caption}")
            continue
        try:
            t0 = time.perf_counter()
            caption = _caption_one(image_bytes)
            elapsed = time.perf_counter() - t0
            times.append(elapsed)
            cNvPr.set("descr", caption)
            stats.alt_generated += 1
            print(f"  [{i}/{len(needs_caption)}] ({elapsed:.1f}s) {caption}")
        except Exception as exc:
            print(f"  [{i}/{len(needs_caption)}] ERROR: {exc}")

    if times:
        print(
            f"  --> Timing — min {min(times):.1f}s  max {max(times):.1f}s  "
            f"avg {sum(times)/len(times):.1f}s  total {sum(times):.1f}s"
        )
