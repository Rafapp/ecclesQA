"""
UI-based alt text generation test.
Attaches to an already-running Word instance with a document open.
"""
import win32com.client
import time
from pywinauto import Application, Desktop
from pywinauto.keyboard import send_keys

TIMEOUT = 30
POLL = 0.5
PANE_THRESHOLD_FROM_RIGHT = 450  # px from right edge to consider "in the task pane"

# ── Attach to running Word ────────────────────────────────────────────────────
word = win32com.client.GetActiveObject("Word.Application")
doc = word.ActiveDocument
hwnd = int(word.ActiveWindow.Hwnd)
print(f"Attached to Word, hwnd={hwnd}, doc={doc.Name}")

app = Application(backend="uia").connect(handle=hwnd)
window = app.window(handle=hwnd)

print("Focusing Word window...")
window.set_focus()
time.sleep(0.5)

# ── Collect all shapes (recursive) ───────────────────────────────────────────
MSO_GROUP = 6
MsoPictureTypes = {11, 13, 28, 29}

def collect_shapes(doc):
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
            # Images inside text boxes
            try:
                if s.HasTextFrame:
                    add_inline(s.TextFrame.TextRange.InlineShapes)
            except Exception:
                pass

    add_inline(doc.InlineShapes)
    add_floating(doc.Shapes)
    return result

all_shapes = collect_shapes(doc)
print(f"Found {len(all_shapes)} shapes.\n")

# ── Helpers ───────────────────────────────────────────────────────────────────

def open_alt_text_pane(shape):
    shape.Select()
    time.sleep(0.4)
    send_keys("+{F10}")
    time.sleep(0.7)
    desktop = Desktop(backend="uia")
    for win in desktop.windows():
        try:
            for ctrl in win.descendants():
                if ctrl.element_info.control_type != "MenuItem":
                    continue
                if "alt text" in ctrl.window_text().strip().lower():
                    ctrl.click_input()
                    time.sleep(0.8)
                    return True
        except Exception:
            continue
    send_keys("{ESCAPE}")
    return False


def pane_controls():
    """All visible controls in the right-side task pane."""
    window_rect = window.rectangle()
    threshold = window_rect.right - PANE_THRESHOLD_FROM_RIGHT
    result = []
    for ctrl in window.descendants():
        try:
            text = ctrl.window_text().strip()
            if not text:
                continue
            rect = ctrl.rectangle()
            if rect.left < threshold:
                continue
            result.append((ctrl.element_info.control_type, text.lower(), ctrl))
        except Exception:
            continue
    return result


def find_pane_button(keywords: list[str]):
    """Return first pane control whose text contains ALL keywords."""
    for _, text, ctrl in pane_controls():
        if all(kw in text for kw in keywords):
            return ctrl
    return None


def wait_for_pane_button(keywords: list[str], timeout: float = 5.0):
    """Poll until a matching pane button appears (pane state catches up)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        btn = find_pane_button(keywords)
        if btn:
            return btn
        time.sleep(POLL)
    return None


def wait_for_alt_text(shape, timeout: float = TIMEOUT):
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(POLL)
        result = (shape.AlternativeText or "").strip()
        if result:
            return result
    return None


# ── Open pane on first image ──────────────────────────────────────────────────
pane_open = False
for kind, shape in all_shapes:
    print(f"Opening Alt Text pane on first {kind} shape...")
    if open_alt_text_pane(shape):
        print("Pane opened.")
        pane_open = True
        break
    print("  Failed, trying next...")

if not pane_open:
    print("ERROR: could not open Alt Text pane.")
    exit(1)

# ── Main loop ─────────────────────────────────────────────────────────────────
for i, (kind, shape) in enumerate(all_shapes):
    print(f"\n--- {kind} {i + 1}/{len(all_shapes)} (type={shape.Type}) ---")

    current = (shape.AlternativeText or "").strip()
    if current:
        print(f"  Already has alt text: \"{current[:80]}\"")
        continue

    shape.Select()
    time.sleep(0.4)

    # Wait for pane to catch up — short timeout since pane updates quickly
    btn = wait_for_pane_button(["generate"], timeout=1.5)
    if btn is None:
        decorative_btn = find_pane_button(["decorative"])
        if decorative_btn:
            print("  No Generate button — marking as decorative.")
            decorative_btn.click_input()
        else:
            print("  No Generate or Decorative button found — skipping.")
        continue

    print(f"  Clicking: '{btn.window_text().strip()}'")
    btn.click_input()

    result = wait_for_alt_text(shape)
    if not result:
        print("  Timed out — no alt text appeared.")
        continue

    print(f"  Generated: \"{result[:100]}\"")

    # Click Approve to remove the AI disclaimer
    approve_btn = wait_for_pane_button(["approve"], timeout=5.0)
    if approve_btn:
        print(f"  Approving: '{approve_btn.window_text().strip()}'")
        approve_btn.click_input()
        time.sleep(0.3)
    else:
        print("  No Approve button found (may not be needed for this shape).")
