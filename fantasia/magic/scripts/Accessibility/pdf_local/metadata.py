"""Apply document-level metadata and viewer preferences."""
from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import BooleanObject, DictionaryObject, NameObject, TextStringObject

from .core import PdfStats, clean_text, default_title_from_path, title_is_usable


LABEL = "Metadata"


def _normalized_metadata(reader: PdfReader) -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in dict(reader.metadata or {}).items():
        if not isinstance(key, str):
            continue
        out[key] = "" if value is None else str(value)
    return out


def _pick_title(path: Path, reader: PdfReader) -> str:
    existing = clean_text(_normalized_metadata(reader).get("/Title"))
    return existing if title_is_usable(existing) else default_title_from_path(path)


def run(path: Path, output_path: Path, stats: PdfStats, lang: str = "en-US") -> str:
    reader = PdfReader(str(path), strict=False)
    writer = PdfWriter(clone_from=reader)

    chosen_title = _pick_title(path, reader)
    metadata = _normalized_metadata(reader)
    if clean_text(metadata.get("/Title")) != chosen_title:
        stats.title_updated = True
    metadata["/Title"] = chosen_title
    writer.add_metadata(metadata)

    root = writer.root_object
    if root.get("/Lang") != lang:
        root[NameObject("/Lang")] = TextStringObject(lang)
        stats.lang_set = True

    viewer_prefs = root.get("/ViewerPreferences")
    if not isinstance(viewer_prefs, DictionaryObject):
        viewer_prefs = DictionaryObject()
        root[NameObject("/ViewerPreferences")] = viewer_prefs
    if viewer_prefs.get("/DisplayDocTitle") is not True:
        viewer_prefs[NameObject("/DisplayDocTitle")] = BooleanObject(True)
        stats.display_title_set = True

    with output_path.open("wb") as fh:
        writer.write(fh)

    return chosen_title

