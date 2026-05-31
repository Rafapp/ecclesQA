"""Reset stale structure so Acrobat can rebuild tags cleanly."""
from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject

from .core import PdfStats

ROOT_KEYS = ("/StructTreeRoot", "/MarkInfo", "/ParentTree", "/RoleMap", "/ClassMap")
STRUCT_KEYS = ("/StructParent", "/StructParents")


def _scrub_object(value, seen: set[tuple[int, int]]) -> None:
    if isinstance(value, IndirectObject):
        marker = (value.idnum, value.generation)
        if marker in seen:
            return
        seen.add(marker)
        _scrub_object(value.get_object(), seen)
        return

    if isinstance(value, DictionaryObject):
        for key in STRUCT_KEYS:
            if key in value:
                del value[NameObject(key)]
        for child in list(value.values()):
            _scrub_object(child, seen)
        return

    if isinstance(value, ArrayObject):
        for child in value:
            _scrub_object(child, seen)


def strip_tags(path: Path, output_path: Path, stats: PdfStats) -> Path:
    reader = PdfReader(str(path), strict=False)
    writer = PdfWriter(clone_from=reader)

    root = writer.root_object
    touched = False
    for key in ROOT_KEYS:
        if key in root:
            del root[NameObject(key)]
            touched = True

    seen: set[tuple[int, int]] = set()
    for page in writer.pages:
        before = len(page)
        _scrub_object(page, seen)
        touched = touched or len(page) != before

    with output_path.open("wb") as fh:
        writer.write(fh)

    if touched:
        stats.structure_reset = True
    return output_path
