"""Run recovered accessibility workflows through Magic's event protocol."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import magic_runner as runner


WORKFLOWS = {
    "docx": {
        "extensions": {".doc", ".docm", ".docx"},
        "module": "Accessibility.docx",
        "arguments": lambda folder: ["--folder", str(folder)],
        "label": "Word documents",
    },
    "pdf": {
        "extensions": {".pdf"},
        "module": "Accessibility.pdf_local",
        "arguments": lambda folder: [str(folder)],
        "label": "PDF files",
    },
    "pptx": {
        "extensions": {".ppt", ".pptm", ".pptx"},
        "module": "Accessibility.pptx",
        "arguments": lambda folder: [str(folder)],
        "label": "PowerPoint files",
    },
    "xlsx": {
        "extensions": {".xls", ".xlsb", ".xlsm", ".xlsx"},
        "module": "Accessibility.xlsx",
        "arguments": lambda folder: [str(folder)],
        "label": "Excel files",
    },
}


def _activity_task(message: str) -> str | None:
    clean = message.lstrip("- >").strip()
    if message.startswith("Loading weights:"):
        return "Load image-captioning model"
    lowered = clean.lower()
    if lowered.startswith("resuming:"):
        if "after-check" in lowered:
            return "Final accessibility check"
        if "alt-text" in lowered:
            return "Generate alt text"
        if "metadata" in lowered:
            return "Update title and metadata"
        return "Initial accessibility check"
    if "security-safe working copy" in lowered:
        return "Prepare security-safe copy"
    if "initial acrobat accessibility check" in lowered or "before check" in lowered:
        return "Initial accessibility check"
    if "ocr" in lowered:
        return "Apply OCR"
    if "autotag" in lowered:
        return "Apply Acrobat autotagging"
    if "title" in lowered or "document metadata" in lowered:
        return "Update title and metadata"
    if "alternate text" in lowered or "alt text" in lowered or "blip" in lowered:
        return "Generate alt text"
    if "final acrobat accessibility check" in lowered or "after check" in lowered:
        return "Final accessibility check"
    if clean.startswith("Saved:"):
        return "Save remediated file"
    if clean.startswith("Skipped Acrobat remediation"):
        return "Continue without Acrobat changes"
    return None


def run_workflow(workflow_id: str, input_folder: str, output_folder: str) -> None:
    workflow = WORKFLOWS[workflow_id]
    source = Path(input_folder).expanduser()
    destination = Path(output_folder).expanduser()

    runner.step_start("scan", "Scanning source folder")
    if not source.is_dir():
        runner.step_error("scan", f"Source folder was not found: {source}")
    if source.resolve() == destination.resolve():
        runner.step_error("scan", "Choose a different output folder so the source files remain unchanged.")

    files = sorted(
        path
        for path in source.iterdir()
        if path.is_file()
        and not path.name.startswith("~$")
        and ".__ecclesqa_" not in path.name.lower()
        and path.suffix.lower() in workflow["extensions"]
    )
    if not files:
        runner.step_error("scan", f"No supported {workflow['label']} were found in {source}.")
    runner.step_info(
        "scan",
        f"Found {len(files)} {workflow['label']} to copy and remediate.",
        [path.name for path in files],
        confirm=True,
    )
    runner.step_done("scan")

    runner.step_start("copy", "Copying files to output folder")
    destination.mkdir(parents=True, exist_ok=True)
    copied = 0
    preserved = 0
    for path in files:
        target = destination / path.name
        if target.exists():
            preserved += 1
        else:
            shutil.copy2(path, target)
            copied += 1
    runner.step_info(
        "copy",
        f"Copied {copied} files and preserved {preserved} existing output files in {destination}.",
    )
    runner.step_done("copy")

    runner.step_start("remediate", "Running accessibility workflow")
    scripts_dir = Path(__file__).resolve().parent
    environment = os.environ.copy()
    existing_python_path = environment.get("PYTHONPATH")
    environment["PYTHONPATH"] = (
        str(scripts_dir)
        if not existing_python_path
        else f"{scripts_dir}{os.pathsep}{existing_python_path}"
    )
    command = [
        sys.executable,
        "-u",
        "-m",
        workflow["module"],
        *workflow["arguments"](destination),
    ]
    process = subprocess.Popen(
        command,
        cwd=scripts_dir,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    file_current = 0
    file_total = len(files)
    file_name = "the current file"
    current_task = "Starting remediation"
    task_item_current = None
    task_item_total = None
    stop_file_value = os.environ.get("MAGIC_STOP_FILE")

    def stop_requested() -> bool:
        return bool(stop_file_value) and Path(stop_file_value).exists()

    def stop_before_next_file() -> None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        runner.run_stopped(
            f"Stopped after {file_name}. Launch the same workflow with the same output folder to resume."
        )

    def send_progress(
        task: str,
        item_current: int | None = None,
        item_total: int | None = None,
    ) -> None:
        nonlocal current_task, task_item_current, task_item_total
        if task != current_task:
            task_item_current = None
            task_item_total = None
        current_task = task
        if item_current is not None and item_total is not None:
            task_item_current = item_current
            task_item_total = item_total
        runner.progress(
            file_current,
            file_total,
            file_name,
            current_task,
            task_item_current,
            task_item_total,
        )

    for line in process.stdout:
        message = line.strip()
        if message:
            counter_match = re.fullmatch(r"\[(\d+)/(\d+)\](?:\s+(.*))?", message)
            if counter_match:
                counter_current = int(counter_match.group(1))
                counter_total = int(counter_match.group(2))
                counter_detail = counter_match.group(3)
                is_file_counter = (
                    not counter_detail
                    or Path(counter_detail).suffix.lower() in workflow["extensions"]
                )
                if is_file_counter:
                    file_current = counter_current
                    file_total = counter_total
                    current_task = "Starting remediation"
                    task_item_current = None
                    task_item_total = None
                    if counter_detail:
                        file_name = counter_detail
                        send_progress("Starting remediation")
                else:
                    task = "Generate alt text" if "alt ->" in counter_detail or counter_detail.startswith("(") else counter_detail
                    send_progress(task, counter_current, counter_total)
            elif message.startswith("[done] Skipping "):
                file_name = message.removeprefix("[done] Skipping ").split(" (use --force", maxsplit=1)[0]
                send_progress("Already complete; skipped")
            elif message.startswith("File: "):
                if file_current and stop_requested():
                    stop_before_next_file()
                    return
                item_name = message.removeprefix("File: ").strip()
                file_name = item_name
                matching_index = next(
                    (index for index, path in enumerate(files, start=1) if path.name == item_name),
                    None,
                )
                if matching_index is not None:
                    file_current = matching_index
                send_progress("Starting remediation")
            nested_item_match = re.search(r"\((\d+)/(\d+)\)\s+generating", message)
            if nested_item_match and file_current:
                send_progress(
                    "Generate alt text",
                    int(nested_item_match.group(1)),
                    int(nested_item_match.group(2)),
                )
            task = _activity_task(message)
            if task and file_current:
                send_progress(task)
            runner.step_info("remediate", message)
    exit_code = process.wait()
    if stop_requested():
        runner.run_stopped("Stopped after the final file. Launch the same workflow with the same output folder to resume.")
        return
    if exit_code:
        runner.step_error("remediate", f"The accessibility workflow ended with exit code {exit_code}.")
    runner.step_done("remediate")

    runner.step_start("save", "Saving remediated files")
    runner.step_info("save", f"Remediated files are available in {destination}.")
    runner.step_done("save")
    runner.run_done("Accessibility workflow complete.")
