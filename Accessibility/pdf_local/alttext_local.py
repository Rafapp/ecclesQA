"""Populate /Alt text on Acrobat-generated /Figure tags using BLIP."""
from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject, TextStringObject

from .core import PdfStats, clean_text


LABEL = "Alt text (local BLIP)"

_MODEL_ID = "Salesforce/blip-image-captioning-large"
_MAX_NEW_TOKENS = 40

_processor = None
_model = None
_device = None


@dataclass
class FigureRef:
    page_index: int | None
    struct: DictionaryObject


def _load_model() -> None:
    global _processor, _model, _device
    if _model is not None:
        return

    import torch
    from transformers import BlipForConditionalGeneration, BlipProcessor

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  --> Loading BLIP large on {_device} ...")
    _processor = BlipProcessor.from_pretrained(_MODEL_ID)
    _model = BlipForConditionalGeneration.from_pretrained(_MODEL_ID).to(_device)
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


def _page_id_map(reader: PdfReader) -> dict[int, int]:
    mapping: dict[int, int] = {}
    for index, page in enumerate(reader.pages):
        ref = getattr(page, "indirect_reference", None)
        if ref is not None:
            mapping[ref.idnum] = index
    return mapping


def _collect_figures(reader: PdfReader) -> list[FigureRef]:
    struct_root = reader.trailer["/Root"].get("/StructTreeRoot")
    if struct_root is None:
        return []

    page_ids = _page_id_map(reader)
    figures: list[FigureRef] = []
    seen: set[tuple[int, int]] = set()

    def walk(obj, current_page: int | None = None) -> None:
        if isinstance(obj, IndirectObject):
            key = (obj.idnum, obj.generation)
            if key in seen:
                return
            seen.add(key)
            walk(obj.get_object(), current_page)
            return

        if isinstance(obj, DictionaryObject):
            page_ref = obj.get("/Pg")
            if isinstance(page_ref, IndirectObject):
                current_page = page_ids.get(page_ref.idnum, current_page)

            if obj.get("/S") == "/Figure":
                figures.append(FigureRef(page_index=current_page, struct=obj))

            child = obj.get("/K")
            if child is not None:
                walk(child, current_page)
            return

        if isinstance(obj, ArrayObject):
            for item in obj:
                walk(item, current_page)

    walk(struct_root.get_object().get("/K"))
    return figures


def _image_bytes_from_xref(doc, xref: int) -> bytes:
    import fitz

    pix = fitz.Pixmap(doc, xref)
    try:
        if pix.alpha:
            pix = fitz.Pixmap(fitz.csRGB, pix)
        elif pix.colorspace is None or pix.colorspace.n not in (1, 3):
            pix = fitz.Pixmap(fitz.csRGB, pix)
        return pix.tobytes("png")
    finally:
        pix = None


def _collect_page_images(path: Path) -> dict[int, list[tuple[str, bytes]]]:
    import fitz

    doc = fitz.open(str(path))
    results: dict[int, list[tuple[str, bytes]]] = {}
    try:
        for page_index in range(doc.page_count):
            page = doc[page_index]
            seen: set[str] = set()
            images: list[tuple[str, bytes]] = []
            infos = page.get_image_info(xrefs=True)
            infos.sort(key=lambda item: (item.get("bbox", (0, 0, 0, 0))[1], item.get("bbox", (0, 0, 0, 0))[0]))
            for info in infos:
                xref = int(info.get("xref", 0) or 0)
                if xref <= 0:
                    continue
                digest = info.get("digest")
                digest_key = digest.hex() if isinstance(digest, (bytes, bytearray)) else hashlib.sha1(f"{page_index}:{xref}".encode("utf-8")).hexdigest()
                if digest_key in seen:
                    continue
                try:
                    image_bytes = _image_bytes_from_xref(doc, xref)
                except Exception:
                    continue
                seen.add(digest_key)
                images.append((digest_key, image_bytes))
            results[page_index] = images
    finally:
        doc.close()
    return results


def _finalize_caption(value: str) -> str:
    flat = clean_text(value).rstrip(".")
    if not flat:
        return ""
    return flat[0].upper() + flat[1:]


def _fallback_caption(page_index: int | None) -> str:
    if page_index is None:
        return "Figure"
    return f"Figure on page {page_index + 1}"


def run(path: Path, output_path: Path, stats: PdfStats) -> None:
    reader = PdfReader(str(path), strict=False)
    figures = _collect_figures(reader)
    stats.figure_tags_seen += len(figures)
    stats.visuals_seen += len(figures)

    if not figures:
        output_path.write_bytes(path.read_bytes())
        return

    page_images = _collect_page_images(path)
    needs_model = any(
        not clean_text(str(fig.struct.get("/Alt") or "")) and page_images.get(fig.page_index)
        for fig in figures
    )
    if needs_model:
        _load_model()

    page_offsets: dict[int, int] = defaultdict(int)
    caption_cache: dict[str, str] = {}
    changed = False

    for index, figure in enumerate(figures, start=1):
        existing = clean_text(str(figure.struct.get("/Alt") or ""))
        if existing:
            stats.alt_already_present += 1
            continue

        caption = ""
        page_index = figure.page_index
        images = page_images.get(page_index, []) if page_index is not None else []
        if images:
            image_offset = page_offsets[page_index]
            page_offsets[page_index] += 1
            if image_offset < len(images):
                digest_key, image_bytes = images[image_offset]
                caption = caption_cache.get(digest_key, "")
                if not caption:
                    try:
                        caption = _finalize_caption(_caption_one(image_bytes))
                    except Exception:
                        caption = ""
                    caption_cache[digest_key] = caption

        if not caption:
            caption = _fallback_caption(page_index)
            stats.alt_fallback += 1

        figure.struct[NameObject("/Alt")] = TextStringObject(caption)
        stats.alt_generated += 1
        changed = True
        print(f"  [{index}/{len(figures)}] alt -> {caption}")

    if not changed:
        output_path.write_bytes(path.read_bytes())
        return

    writer = PdfWriter(clone_from=reader)
    with output_path.open("wb") as fh:
        writer.write(fh)

