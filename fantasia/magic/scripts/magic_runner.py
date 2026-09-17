"""
Shared protocol helpers for Magic scripts.

Scripts emit JSON lines to stdout. The renderer parses these and drives the
step timeline + confirmation dialogs. Plain non-JSON lines are treated as
raw log output and appended to the current step's log.

Message types (all include "type"):

  step_start  { id, label }
    — Mark step as running in the timeline.

  step_info   { id, message, items?: [str] }
    — Append a log line (and optional item list) to the current step.
      If confirm=true in manifest, the UI will pause here for Continue/Abort.

  step_done   { id }
    — Mark step as complete (green).

  step_error  { id, message }
    — Mark step as failed (red) and halt the run.

  run_done    { message? }
    — Script finished successfully.

  run_error   { message }
    — Script failed at a top level not tied to a step.
"""

import json
import sys


def _emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def step_start(step_id: str, label: str) -> None:
    _emit({"type": "step_start", "id": step_id, "label": label})


def step_info(step_id: str, message: str, items: list[str] | None = None, confirm: bool = False) -> None:
    payload = {"type": "step_info", "id": step_id, "message": message, "confirm": confirm}
    if items is not None:
        payload["items"] = items
    _emit(payload)
    if confirm:
        response = sys.stdin.readline().strip()
        if response != "continue":
            _emit({"type": "run_error", "message": "Aborted by user."})
            sys.exit(0)


def step_done(step_id: str) -> None:
    _emit({"type": "step_done", "id": step_id})


def step_error(step_id: str, message: str) -> None:
    _emit({"type": "step_error", "id": step_id, "message": message})
    sys.exit(1)


def run_done(message: str = "Done.") -> None:
    _emit({"type": "run_done", "message": message})


def run_error(message: str) -> None:
    _emit({"type": "run_error", "message": message})
    sys.exit(1)


def abort_if(condition: bool, step_id: str, message: str) -> None:
    if condition:
        step_error(step_id, message)
