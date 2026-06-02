"""Module: mark purely decorative shapes (auto-shapes, freeforms, lines) as decorative."""
from __future__ import annotations

from lxml import etree
from pptx.oxml.ns import qn

from .core import PresentationStats, clean_text

LABEL = "Decorative shapes"

_ADEC_NS  = "http://schemas.microsoft.com/office/drawing/2017/decorative"
_ADEC_URI = "{C183D7F6-B498-43B3-948B-1728B52AA6E4}"

# sp elements that are purely structural/decorative (no image content)
_P_SP    = qn("p:sp")
_P_CXN   = qn("p:cxnSp")   # connectors and lines
_A_BLIP  = qn("a:blip")


def _already_decorative(cNvPr) -> bool:
    extLst = cNvPr.find(qn("a:extLst"))
    if extLst is None:
        return False
    for ext in extLst.findall(qn("a:ext")):
        if ext.get("uri") == _ADEC_URI:
            return True
    return False


def _mark_decorative(cNvPr) -> None:
    cNvPr.set("descr", "")
    extLst = cNvPr.find(qn("a:extLst"))
    if extLst is None:
        extLst = etree.SubElement(cNvPr, qn("a:extLst"))
    ext = etree.SubElement(extLst, qn("a:ext"))
    ext.set("uri", _ADEC_URI)
    dec = etree.SubElement(ext, f"{{{_ADEC_NS}}}decorative")
    dec.set("val", "1")


def run(prs, stats: PresentationStats, ctx: dict) -> None:
    """Entry point called by the orchestrator."""
    marked = 0
    skipped = 0

    for slide in prs.slides:
        root = slide._element

        for tag in (_P_SP, _P_CXN):
            for el in root.iter(tag):
                try:
                    # Skip if this sp contains an image — alttext module handles those
                    if el.find(".//" + _A_BLIP) is not None:
                        continue
                    cNvPr = (
                        el.nvSpPr.cNvPr if tag == _P_SP else el.nvCxnSpPr.cNvPr
                    )
                    if _already_decorative(cNvPr):
                        skipped += 1
                        continue
                    # Skip if meaningful alt text already set by a human
                    if clean_text(cNvPr.get("descr") or ""):
                        skipped += 1
                        continue
                    _mark_decorative(cNvPr)
                    marked += 1
                except Exception:
                    pass

    if marked == 0:
        print(f"  --> Skipped ({skipped} shape(s) already marked decorative).")
        return

    stats.decorative_marked += marked
    print(f"  --> Marked {marked} shape(s) as decorative ({skipped} already done).")
