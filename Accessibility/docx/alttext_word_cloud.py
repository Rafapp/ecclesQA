"""Module: generate and set alt text on images in a Word document.

Expected context keys
---------------------
window : pywinauto window object
    The active Word window, used to locate pane buttons.
"""
from __future__ import annotations

import time

from .core import DocumentStats, summarize, strip_ai_footer

LABEL = "Alt text (Word AI)"

# ── Constants ─────────────────────────────────────────────────────────────────

MSO_GROUP = 6
MsoPictureTypes = {11, 13, 28, 29}

POLL = 0.2
ALT_TEXT_TIMEOUT = 30
GENERATE_WAIT_TIMEOUT = 1.5   # how long to wait for Generate button to appear
DECORATIVE_WAIT_TIMEOUT = 1.0  # shorter — if no Generate button it shows up fast
APPROVE_TIMEOUT = 2.0
PANE_THRESHOLD_FROM_RIGHT = 450


# ── Shape collection ──────────────────────────────────────────────────────────

def collect_shapes(doc) -> list:
    result = []

    def add_inline(col):
        for s in col:
            result.append(("inline", s))

    def add_floating(col):
        for s in col:
            t = getattr(s, "Type", None)
            if t == MSO_GROUP:
                try:
                    add_floating(s.GroupItems)
                except Exception:
                    pass
            elif t in MsoPictureTypes:
                result.append(("floating", s))
            try:
                if s.HasTextFrame:
                    add_inline(s.TextFrame.TextRange.InlineShapes)
            except Exception:
                pass

    add_inline(doc.InlineShapes)
    add_floating(doc.Shapes)
    return result


# ── UI / pane helpers ─────────────────────────────────────────────────────────

def _pane_threshold(window) -> int:
    return window.rectangle().right - PANE_THRESHOLD_FROM_RIGHT


def _pane_controls(window, threshold: int):
    result = []
    for ctrl in window.descendants():
        try:
            text = ctrl.window_text().strip()
            if not text or ctrl.rectangle().left < threshold:
                continue
            result.append((ctrl.element_info.control_type, text.lower(), ctrl))
        except Exception:
            continue
    return result


def _find_pane_button(window, keywords: list[str]):
    for _, text, ctrl in _pane_controls(window, _pane_threshold(window)):
        if all(kw in text for kw in keywords):
            return ctrl
    return None


def _wait_for_pane_button(window, keywords: list[str], timeout: float):
    threshold = _pane_threshold(window)
    deadline = time.time() + timeout
    while time.time() < deadline:
        for _, text, ctrl in _pane_controls(window, threshold):
            if all(kw in text for kw in keywords):
                return ctrl
        time.sleep(POLL)
    return None


def _wait_for_either_pane_button(
    window,
    keywords_a: list[str],
    keywords_b: list[str],
    timeout: float,
):
    """Poll for two mutually exclusive buttons simultaneously.

    Returns ``("a", ctrl)`` or ``("b", ctrl)`` for whichever appears first,
    or ``(None, None)`` on timeout.
    """
    threshold = _pane_threshold(window)
    deadline = time.time() + timeout
    while time.time() < deadline:
        for _, text, ctrl in _pane_controls(window, threshold):
            if all(kw in text for kw in keywords_a):
                return "a", ctrl
            if all(kw in text for kw in keywords_b):
                return "b", ctrl
        time.sleep(POLL)
    return None, None


def _wait_for_alt_text(shape, timeout: float = ALT_TEXT_TIMEOUT):
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = (shape.AlternativeText or "").strip()
        if result:
            return result
        time.sleep(POLL)
    return None


def _open_alt_text_pane(shape) -> bool:
    from pywinauto import Desktop
    from pywinauto.keyboard import send_keys

    shape.Select()
    time.sleep(0.2)
    send_keys("+{F10}")
    time.sleep(0.4)
    desktop = Desktop(backend="uia")
    for win in desktop.windows():
        try:
            for ctrl in win.descendants():
                if ctrl.element_info.control_type != "MenuItem":
                    continue
                if "alt text" in ctrl.window_text().strip().lower():
                    ctrl.click_input()
                    time.sleep(0.4)
                    return True
        except Exception:
            continue
    send_keys("{ESCAPE}")
    return False


# ── Alt-text processing ───────────────────────────────────────────────────────

def _process_alt_text(shapes: list, stats: DocumentStats, window) -> None:
    if not shapes:
        print("  --> No images found.")
        return

    pane_open = False
    for kind, shape in shapes:
        if _open_alt_text_pane(shape):
            pane_open = True
            break
        print(f"    Could not open pane on {kind} shape, trying next...")

    if not pane_open:
        print("  --> Could not open Alt Text pane — skipping all images.")
        return

    for i, (kind, shape) in enumerate(shapes):
        label = f"{kind} {i + 1}/{len(shapes)}"
        stats.visuals_seen += 1

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

        if i > 0:
            shape.Select()
            time.sleep(0.2)

        tag, btn = _wait_for_either_pane_button(
            window,
            ["generate"],
            ["decorative"],
            timeout=max(GENERATE_WAIT_TIMEOUT, DECORATIVE_WAIT_TIMEOUT),
        )
        if tag == "b":
            btn.click_input()
            stats.alt_decorative += 1
            print(f"    [{label}] No Generate button — marked decorative.")
            continue
        if tag is None:
            print(f"    [{label}] No Generate or Decorative button — skipping.")
            continue

        print(f"    [{label}] Generating...")
        btn.click_input()

        result = strip_ai_footer(_wait_for_alt_text(shape) or "")
        if not result:
            print(f"    [{label}] Timed out — marked decorative.")
            decorative_btn = _find_pane_button(window, ["decorative"])
            if decorative_btn:
                decorative_btn.click_input()
            stats.alt_decorative += 1
            continue

        print(f"    [{label}] Generated: \"{summarize(result)}\"")
        shape.AlternativeText = result
        stats.alt_generated += 1

        approve_btn = _find_pane_button(window, ["approve"])
        if approve_btn is None:
            time.sleep(APPROVE_TIMEOUT)
            approve_btn = _find_pane_button(window, ["approve"])
        if approve_btn:
            approve_btn.click_input()
            time.sleep(0.2)


# ── Public module interface ───────────────────────────────────────────────────

def run(doc, stats: DocumentStats, ctx: dict) -> None:
    """Entry point called by the orchestrator.

    Required ctx keys:
        window — pywinauto window for the active Word document
    """
    window = ctx["window"]
    shapes = collect_shapes(doc)
    print(f"  --> {len(shapes)} image(s) found.")
    _process_alt_text(shapes, stats, window)
