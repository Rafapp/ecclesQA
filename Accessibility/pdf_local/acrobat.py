"""Acrobat-driven OCR, autotagging, and accessibility checking."""
from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import time
import winreg
from collections import deque
from pathlib import Path

import pythoncom
import win32com.client
import win32con
import win32gui
import win32ui
from pywinauto import Application, mouse
from pywinauto.keyboard import send_keys
from pypdf import PdfReader

PW_RENDERFULLCONTENT = 0x00000002
ACCESSIBILITY_ROW_POINT = (0.919, 0.641)
AUTOTAG_DOCUMENT_POINT = (0.882, 0.209)


class AcrobatError(RuntimeError):
    """Raised when Acrobat automation fails or crashes."""


class AcrobatSession:
    def __init__(self, clean_start: bool = True) -> None:
        self.clean_start = clean_start
        self.app = None
        self.avdoc = None

    def __enter__(self) -> "AcrobatSession":
        self._set_local_autotagging()
        if self.clean_start:
            self._kill_acrobat()
        pythoncom.CoInitialize()
        self.app = win32com.client.Dispatch("AcroExch.App")
        self.app.Show()
        time.sleep(1)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if self.avdoc is not None:
                self.close_document()
        except Exception:
            pass
        try:
            if self.app is not None:
                self.app.Hide()
        except Exception:
            pass
        pythoncom.CoUninitialize()
        self.app = None
        self.avdoc = None

    def open_document(self, path: Path) -> None:
        self.close_document()
        self._ensure_not_crashed()

        self.avdoc = win32com.client.Dispatch("AcroExch.AVDoc")
        if not self.avdoc.Open(str(path), ""):
            raise AcrobatError(f"Acrobat could not open {path.name}.")
        time.sleep(3)
        self.avdoc.BringToFront()
        try:
            self._focus_document_window(path)
        except AcrobatError:
            pass

    def close_document(self) -> None:
        if self.avdoc is None:
            return
        try:
            self.avdoc.Close(1)
        finally:
            self.avdoc = None
            time.sleep(1)

    def run_accessibility_check(self, path: Path, timeout_seconds: int = 120) -> Path:
        report_path = self._report_path_for(path)
        report_path.unlink(missing_ok=True)

        self.open_document(path)
        self._ensure_not_crashed()
        if not self.app.MenuItemExecute("AccCheck:DoCheck"):
            raise AcrobatError("Failed to launch Acrobat accessibility checker.")
        self._spawn_checker_helper()

        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            self._ensure_not_crashed()
            self._maybe_start_checker()
            if report_path.exists() and report_path.stat().st_size > 0:
                self.close_document()
                return report_path
            time.sleep(0.5)

        raise AcrobatError(f"Accessibility report was not generated for {path.name}.")

    def perform_ocr(self, path: Path) -> int:
        if self.avdoc is None:
            raise AcrobatError("No PDF is currently open in Acrobat.")

        hwnd = self.maximize_document_window(path)
        self._activate_window(hwnd)
        if not self.app.MenuItemExecute("P2P:ShowOCR"):
            raise AcrobatError("Failed to open Acrobat OCR controls.")
        time.sleep(2)
        self._activate_window(hwnd)

        ocr_x, ocr_y = self._find_ocr_button_center(hwnd)
        mouse.click(coords=(ocr_x, ocr_y))

        page_count = int(self.avdoc.GetPDDoc().GetNumPages())
        wait_seconds = max(20, min(300, page_count * 8))
        time.sleep(wait_seconds)
        self._ensure_not_crashed()
        return wait_seconds

    def maximize_document_window(self, path: Path) -> int:
        hwnd = self._find_document_window(path)
        win32gui.ShowWindow(hwnd, win32con.SW_MAXIMIZE)
        self._activate_window(hwnd)
        time.sleep(1)
        return hwnd

    def open_all_tools(self, path: Path, maximize: bool = False) -> int:
        if self.avdoc is None:
            raise AcrobatError("No PDF is currently open in Acrobat.")

        if maximize:
            self.maximize_document_window(path)
        else:
            self._focus_document_window(path)

        if not self.app.MenuItemExecute("ToolsActions"):
            raise AcrobatError("Failed to open Acrobat All Tools pane.")
        time.sleep(2)
        return self._find_document_window(path)

    def capture_document_window(self, path: Path, target_path: Path) -> Path:
        hwnd = self._find_document_window(path)
        self._capture_window(hwnd, target_path)
        return target_path

    def capture_task_pane(self, path: Path, target_path: Path) -> Path:
        hwnd = self._find_task_pane_handle(path)
        self._capture_window(hwnd, target_path)
        return target_path

    def make_accessible_and_wait(
        self,
        path: Path,
        snapshot_path: Path,
        timeout_seconds: int | None = None,
        prefer_ui: bool = False,
    ) -> Path:
        if self.avdoc is None:
            raise AcrobatError("No PDF is currently open in Acrobat.")

        self._focus_document_window(path)
        document_hwnd = self._find_document_window(path)
        started = False
        used_ui_fallback = prefer_ui

        if prefer_ui:
            hwnd = self._open_accessibility_tool(path)
            self._click_window_relative(hwnd, *AUTOTAG_DOCUMENT_POINT)
            time.sleep(1)
            self._dismiss_setup_assistant()
            self._dismiss_generic_ok_dialogs()
            self._confirm_retag_prompt(hwnd, fallback_enter=True)
            started = True
        else:
            started = bool(self.app.MenuItemExecute("Adobe:MakeAccessible"))
            if not started:
                hwnd = self._open_accessibility_tool(path)
                self._click_window_relative(hwnd, *AUTOTAG_DOCUMENT_POINT)
                time.sleep(1)
                used_ui_fallback = True

        self._dismiss_setup_assistant()
        self._dismiss_generic_ok_dialogs()

        page_count = int(self.avdoc.GetPDDoc().GetNumPages())
        timeout_seconds = timeout_seconds or max(180, min(720, page_count * 18))
        probe_interval = max(10, min(30, page_count * 2))
        deadline = time.time() + timeout_seconds
        next_probe = time.time() + probe_interval
        fallback_at = time.time() + max(20, min(60, probe_interval * 2))
        attempt = 0

        while time.time() < deadline:
            self._ensure_not_crashed()
            self._dismiss_setup_assistant()
            self._dismiss_generic_ok_dialogs()
            self._confirm_retag_prompt(document_hwnd)
            if not used_ui_fallback and time.time() >= fallback_at:
                hwnd = self._open_accessibility_tool(path)
                self._click_window_relative(hwnd, *AUTOTAG_DOCUMENT_POINT)
                time.sleep(1)
                self._dismiss_setup_assistant()
                self._dismiss_generic_ok_dialogs()
                self._confirm_retag_prompt(hwnd, fallback_enter=True)
                used_ui_fallback = True
            if time.time() >= next_probe:
                attempt += 1
                probe_path = snapshot_path.with_name(
                    f"{snapshot_path.stem}.poll{attempt}{snapshot_path.suffix}"
                )
                probe_path.unlink(missing_ok=True)
                self.save_snapshot(probe_path)
                if _snapshot_has_tags(probe_path):
                    return probe_path
                next_probe = time.time() + probe_interval
            time.sleep(1)

        final_probe = snapshot_path.with_name(f"{snapshot_path.stem}.timeout{snapshot_path.suffix}")
        final_probe.unlink(missing_ok=True)
        self.save_snapshot(final_probe)
        if _snapshot_has_tags(final_probe):
            return final_probe

        raise AcrobatError("Timed out waiting for Acrobat to finish autotagging.")

    def save_snapshot(self, target_path: Path) -> None:
        if self.avdoc is None:
            raise AcrobatError("No PDF is currently open in Acrobat.")

        target_path.unlink(missing_ok=True)
        ok = self.avdoc.GetPDDoc().Save(1, str(target_path))
        if not ok:
            raise AcrobatError(f"Acrobat failed to save a snapshot to {target_path.name}.")

    def _maybe_start_checker(self) -> None:
        for hwnd in self._find_windows_by_title("Accessibility Checker Options"):
            dialog = Application(backend="win32").connect(handle=hwnd).window(handle=hwnd)
            try:
                checkbox = dialog.child_window(
                    title="Show &this dialog when the Checker starts",
                    class_name="Button",
                )
                if checkbox.exists() and checkbox.get_check_state():
                    checkbox.click()
            except Exception:
                pass
            dialog.child_window(title="&Start Checking", class_name="Button").click()

    @staticmethod
    def _spawn_checker_helper() -> None:
        script = r"""
import time
import win32gui
from pywinauto import Application

deadline = time.time() + 30
while time.time() < deadline:
    matches = []

    def callback(hwnd, _):
        if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd) == 'Accessibility Checker Options':
            matches.append(hwnd)

    win32gui.EnumWindows(callback, None)
    for hwnd in matches:
        try:
            dialog = Application(backend='win32').connect(handle=hwnd).window(handle=hwnd)
            try:
                checkbox = dialog.child_window(
                    title='Show &this dialog when the Checker starts',
                    class_name='Button',
                )
                if checkbox.exists() and checkbox.get_check_state():
                    checkbox.click()
            except Exception:
                pass
            dialog.child_window(title='&Start Checking', class_name='Button').click()
        except Exception:
            pass
    time.sleep(0.5)
"""
        subprocess.Popen(
            [sys.executable, "-c", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def _dismiss_setup_assistant(self) -> None:
        for hwnd in self._find_windows_by_title("Accessibility Setup Assistant"):
            dialog = Application(backend="win32").connect(handle=hwnd).window(handle=hwnd)
            for title in (
                "Use recommended settings and skip setup",
                "&Use recommended settings and skip setup",
            ):
                try:
                    button = dialog.child_window(title=title, class_name="Button")
                    if button.exists():
                        button.click()
                        time.sleep(1)
                        return
                except Exception:
                    continue

    def _dismiss_generic_ok_dialogs(self) -> int:
        dismissed = 0
        for hwnd in self._find_windows_by_title("Adobe Acrobat"):
            try:
                dialog = Application(backend="win32").connect(handle=hwnd).window(handle=hwnd)
                for title in ("&OK", "OK"):
                    button = dialog.child_window(title=title, class_name="Button")
                    if button.exists():
                        button.click()
                        dismissed += 1
                        time.sleep(0.4)
                        break
            except Exception:
                continue
        return dismissed

    def _open_accessibility_tool(self, path: Path) -> int:
        hwnd = self.open_all_tools(path, maximize=True)
        self._click_window_relative(hwnd, *ACCESSIBILITY_ROW_POINT)
        time.sleep(3)
        self._dismiss_setup_assistant()
        self._dismiss_generic_ok_dialogs()
        return hwnd

    def _ensure_not_crashed(self) -> None:
        crash_titles = (
            'Error Report for "Adobe Acrobat"',
            "Error Report for “Adobe Acrobat”",
            "Error Report for â€œAdobe Acrobatâ€",
        )
        for title in crash_titles:
            if self._find_windows_by_title(title):
                raise AcrobatError("Acrobat crashed while processing the PDF.")

    def _focus_document_window(self, path: Path) -> None:
        hwnd = self._find_document_window(path)
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        self._activate_window(hwnd)
        time.sleep(1)

    @staticmethod
    def _activate_window(hwnd: int) -> None:
        title = win32gui.GetWindowText(hwnd)
        shell = win32com.client.Dispatch("WScript.Shell")
        shell.SendKeys("%")
        try:
            shell.AppActivate(title)
        except Exception:
            try:
                win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass

    @staticmethod
    def _find_ocr_button_center(hwnd: int) -> tuple[int, int]:
        from PIL import ImageGrab

        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        shot = ImageGrab.grab((left, top, right, bottom)).convert("RGB")
        width, height = shot.size
        pixels = shot.load()
        visited = [[False] * width for _ in range(height)]
        candidates: list[tuple[int, int, int, int, int]] = []

        min_x = max(500, width // 3)
        max_x = min(width, width - 200)
        min_y = min(120, max(0, height - 1))
        max_y = min(height, 260)

        for y in range(min_y, max_y):
            for x in range(min_x, max_x):
                if visited[y][x]:
                    continue

                visited[y][x] = True
                red, green, blue = pixels[x, y]
                if not (blue > 170 and green > 90 and red < 120):
                    continue

                queue = deque([(x, y)])
                points = []
                while queue:
                    cx, cy = queue.popleft()
                    points.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if (
                            min_x <= nx < max_x
                            and min_y <= ny < max_y
                            and not visited[ny][nx]
                        ):
                            visited[ny][nx] = True
                            nred, ngreen, nblue = pixels[nx, ny]
                            if nblue > 170 and ngreen > 90 and nred < 120:
                                queue.append((nx, ny))

                if len(points) < 100:
                    continue

                xs = [point[0] for point in points]
                ys = [point[1] for point in points]
                candidates.append((len(points), min(xs), min(ys), max(xs), max(ys)))

        if candidates:
            _, x1, y1, x2, y2 = max(candidates)
            return left + ((x1 + x2) // 2), top + ((y1 + y2) // 2)

        width = right - left
        height = bottom - top
        return left + int(width * 0.603), top + int(height * 0.195)

    def _confirm_retag_prompt(self, hwnd: int, fallback_enter: bool = False) -> bool:
        from PIL import ImageGrab

        self._activate_window(hwnd)
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        shot = ImageGrab.grab((left, top, right, bottom)).convert("RGB")
        width, height = shot.size
        pixels = shot.load()
        visited = [[False] * width for _ in range(height)]
        candidates: list[tuple[int, int, int, int, int]] = []

        min_x = int(width * 0.58)
        max_x = int(width * 0.96)
        min_y = int(height * 0.55)
        max_y = int(height * 0.90)

        for y in range(min_y, max_y):
            for x in range(min_x, max_x):
                if visited[y][x]:
                    continue

                visited[y][x] = True
                red, green, blue = pixels[x, y]
                if not (blue > 150 and green > 70 and red < 90):
                    continue

                queue = deque([(x, y)])
                points = []
                while queue:
                    cx, cy = queue.popleft()
                    points.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if (
                            min_x <= nx < max_x
                            and min_y <= ny < max_y
                            and not visited[ny][nx]
                        ):
                            visited[ny][nx] = True
                            nred, ngreen, nblue = pixels[nx, ny]
                            if nblue > 150 and ngreen > 70 and nred < 90:
                                queue.append((nx, ny))

                if len(points) < 400:
                    continue

                xs = [point[0] for point in points]
                ys = [point[1] for point in points]
                x1, y1, x2, y2 = min(xs), min(ys), max(xs), max(ys)
                box_width = x2 - x1
                box_height = y2 - y1
                if 70 <= box_width <= 220 and 25 <= box_height <= 90:
                    candidates.append((len(points), x1, y1, x2, y2))

        if candidates:
            _, x1, y1, x2, y2 = max(candidates)
            mouse.click(coords=(left + ((x1 + x2) // 2), top + ((y1 + y2) // 2)))
            time.sleep(1)
            return True

        if fallback_enter:
            send_keys("{ENTER}")
            time.sleep(1)
            return True

        return False

    @staticmethod
    def _click_window_relative(hwnd: int, x_ratio: float, y_ratio: float) -> None:
        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top
        x = left + int(width * x_ratio)
        y = top + int(height * y_ratio)
        mouse.click(coords=(x, y))

    def _find_document_window(self, path: Path, timeout_seconds: int = 15) -> int:
        deadline = time.time() + timeout_seconds
        needle = path.name.lower()
        stem_needle = path.stem.lower()
        stem_prefix = stem_needle[:18]
        while time.time() < deadline:
            windows: list[int] = []
            document_windows: list[int] = []

            def callback(hwnd, _):
                if not win32gui.IsWindowVisible(hwnd):
                    return
                title = win32gui.GetWindowText(hwnd).lower()
                if (
                    win32gui.GetClassName(hwnd) == "AcrobatSDIWindow"
                    and title != "adobe acrobat (64-bit)"
                ):
                    document_windows.append(hwnd)
                if needle in title or (stem_prefix and stem_prefix in title):
                    windows.append(hwnd)

            win32gui.EnumWindows(callback, None)
            if windows:
                return windows[0]
            if len(document_windows) == 1:
                return document_windows[0]
            time.sleep(0.2)

        raise AcrobatError(f"Could not find the Acrobat window for {path.name}.")

    def _find_task_pane_handle(self, path: Path, timeout_seconds: int = 15) -> int:
        document_hwnd = self._find_document_window(path, timeout_seconds=timeout_seconds)
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            task_panes: list[int] = []

            def callback(hwnd, _):
                try:
                    if (
                        win32gui.GetClassName(hwnd) == "AVL_AVView"
                        and win32gui.GetWindowText(hwnd) == "AVTaskPaneHostView"
                    ):
                        task_panes.append(hwnd)
                except Exception:
                    return

            win32gui.EnumChildWindows(document_hwnd, callback, None)
            if task_panes:
                return task_panes[0]
            time.sleep(0.2)

        raise AcrobatError(f"Could not find the Acrobat task pane for {path.name}.")

    @staticmethod
    def _find_windows_by_title(title: str) -> list[int]:
        matches: list[int] = []

        def callback(hwnd, _):
            if win32gui.IsWindowVisible(hwnd) and win32gui.GetWindowText(hwnd) == title:
                matches.append(hwnd)

        win32gui.EnumWindows(callback, None)
        return matches

    @staticmethod
    def _report_path_for(path: Path) -> Path:
        appdata = Path(os.environ["APPDATA"])
        return appdata / "Adobe" / "Acrobat" / "DC" / "AccReports" / f"__{path.name}.accreport.html"

    @staticmethod
    def _kill_acrobat() -> None:
        subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-Process Acrobat -ErrorAction SilentlyContinue | Stop-Process -Force",
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        time.sleep(1)

    @staticmethod
    def _set_local_autotagging() -> None:
        key_path = r"Software\Adobe\Adobe Acrobat\DC\Access"
        key = winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path)
        try:
            winreg.SetValueEx(key, "bEnableCloudBasedAT", 0, winreg.REG_DWORD, 0)
        finally:
            winreg.CloseKey(key)

    @staticmethod
    def _capture_window(hwnd: int, target_path: Path) -> None:
        from PIL import Image

        left, top, right, bottom = win32gui.GetWindowRect(hwnd)
        width = right - left
        height = bottom - top
        if width <= 0 or height <= 0:
            raise AcrobatError("Acrobat returned an invalid window size for capture.")

        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.unlink(missing_ok=True)

        hwnd_dc = win32gui.GetWindowDC(hwnd)
        mfc_dc = win32ui.CreateDCFromHandle(hwnd_dc)
        save_dc = mfc_dc.CreateCompatibleDC()
        bitmap = win32ui.CreateBitmap()

        try:
            bitmap.CreateCompatibleBitmap(mfc_dc, width, height)
            save_dc.SelectObject(bitmap)
            result = ctypes.windll.user32.PrintWindow(
                hwnd,
                save_dc.GetSafeHdc(),
                PW_RENDERFULLCONTENT,
            )
            if not result:
                raise AcrobatError("Acrobat did not render a window capture.")

            bitmap_info = bitmap.GetInfo()
            bitmap_bytes = bitmap.GetBitmapBits(True)
            image = Image.frombuffer(
                "RGB",
                (bitmap_info["bmWidth"], bitmap_info["bmHeight"]),
                bitmap_bytes,
                "raw",
                "BGRX",
                0,
                1,
            )
            image.save(target_path)
        finally:
            win32gui.DeleteObject(bitmap.GetHandle())
            save_dc.DeleteDC()
            mfc_dc.DeleteDC()
            win32gui.ReleaseDC(hwnd, hwnd_dc)


def _snapshot_has_tags(path: Path) -> bool:
    if not path.exists():
        return False
    reader = PdfReader(str(path), strict=False)
    root = reader.trailer["/Root"]
    mark_info = root.get("/MarkInfo")
    return (
        root.get("/StructTreeRoot") is not None
        and mark_info is not None
        and bool(mark_info.get("/Marked"))
    )
