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
        "tasks": ["Alt text", "Title metadata", "Headings", "Table headers"],
    },
    "pdf": {
        "extensions": {".pdf"},
        "module": "Accessibility.pdf_local",
        "arguments": lambda folder: [str(folder)],
        "label": "PDF files",
        "tasks": [
            "Prepare document",
            "Initial accessibility check",
            "Acrobat remediation",
            "Document metadata",
            "Alternate text",
            "Finalize and verify",
        ],
    },
    "pptx": {
        "extensions": {".ppt", ".pptm", ".pptx"},
        "module": "Accessibility.pptx",
        "arguments": lambda folder: [str(folder)],
        "label": "PowerPoint files",
        "tasks": ["Alt text", "Decorative shapes", "Title metadata"],
    },
    "xlsx": {
        "extensions": {".xls", ".xlsb", ".xlsm", ".xlsx"},
        "module": "Accessibility.xlsx",
        "arguments": lambda folder: [str(folder)],
        "label": "Excel files",
        "tasks": ["Convert legacy workbook"],
    },
}


def _activity_progress(workflow_id: str, message: str) -> tuple[str, str, int, int, bool] | None:
    clean = message.lstrip("- >").strip()
    if message.startswith("Loading weights:"):
        task = "Alternate text" if workflow_id == "pdf" else "Alt text"
        return (task, "Load image-captioning model", 1, 1, False)
    lowered = clean.lower()
    if lowered.startswith("resuming:"):
        if "after-check" in lowered:
            return ("Finalize and verify", "Run final accessibility check", 2, 2, False)
        if "alt-text" in lowered:
            return ("Alternate text", "Generate figure captions", 1, 1, False)
        if "metadata" in lowered:
            return ("Document metadata", "Update title and metadata", 1, 1, False)
        return ("Initial accessibility check", "Scan document", 1, 1, False)
    if "security-safe working copy" in lowered:
        return ("Prepare document", "Create security-safe copy", 1, 1, False)
    if "initial acrobat accessibility check" in lowered or "before check" in lowered:
        return ("Initial accessibility check", "Scan document", 1, 1, False)
    if "ocr" in lowered:
        return ("Acrobat remediation", "Apply OCR", 1, 2, False)
    if "autotag" in lowered:
        return ("Acrobat remediation", "Apply Acrobat autotagging", 2, 2, False)
    if lowered.startswith("updating title") or lowered.startswith("title after") or "document metadata" in lowered:
        task = "Document metadata" if workflow_id == "pdf" else "Title metadata"
        return (task, "Update title and metadata", 1, 1, False)
    alt_activity = (
        lowered.startswith("alt text")
        or lowered.startswith("loading blip")
        or lowered.startswith("generating and checking figure alternate text")
        or "need alt text" in lowered
    )
    if alt_activity:
        task = "Alternate text" if workflow_id == "pdf" else "Alt text"
        step = "Load image-captioning model" if "load" in lowered or "initializ" in lowered else "Generate captions"
        return (task, step, 1, 1, False)
    if "final acrobat accessibility check" in lowered or "after check" in lowered:
        return ("Finalize and verify", "Run final accessibility check", 2, 2, False)
    if clean.startswith("Saved:"):
        task = "Finalize and verify" if workflow_id == "pdf" else WORKFLOWS[workflow_id]["tasks"][-1]
        return (task, "Save remediated file", 1, 2 if workflow_id == "pdf" else 1, True)
    if clean.startswith("Skipped Acrobat remediation"):
        return ("Acrobat remediation", "No Acrobat changes needed", 2, 2, True)
    if workflow_id == "xlsx" and "converting to .xlsx" in lowered:
        return ("Convert legacy workbook", "Convert workbook", 1, 1, False)
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
    tasks = workflow["tasks"]
    current_task = tasks[0]
    current_step = "Starting remediation"
    step_current = 1
    step_total = 1
    step_determinate = False
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
        step: str,
        current: int = 1,
        total: int = 1,
        determinate: bool = False,
    ) -> None:
        nonlocal current_task, current_step, step_current, step_total, step_determinate
        current_task = task
        current_step = step
        step_current = current
        step_total = total
        step_determinate = determinate
        task_current = next(
            (index for index, name in enumerate(tasks, start=1) if name == task),
            1,
        )
        runner.progress(
            file_current,
            file_total,
            file_name,
            task_current,
            len(tasks),
            current_task,
            step_current,
            step_total,
            current_step,
            step_determinate,
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
                    current_task = tasks[0]
                    current_step = "Starting remediation"
                    step_current = 1
                    step_total = 1
                    step_determinate = False
                    if counter_detail:
                        file_name = counter_detail
                        send_progress(tasks[0], "Starting remediation")
                else:
                    module_task = next(
                        (task for task in tasks if counter_detail.lower().startswith(task.lower())),
                        None,
                    )
                    if module_task:
                        send_progress(module_task, "Run remediation module")
                    else:
                        task = "Alternate text" if workflow_id == "pdf" else "Alt text"
                        send_progress(task, "Generate captions", counter_current, counter_total, True)
            elif message.startswith("[done] Skipping "):
                file_name = message.removeprefix("[done] Skipping ").split(" (use --force", maxsplit=1)[0]
                send_progress(tasks[-1], "Already complete; skipped", 1, 1, True)
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
                send_progress(tasks[0], "Starting remediation")
            module_match = re.fullmatch(r"\[([^]]+)\]", message)
            if module_match:
                module_label = module_match.group(1)
                module_task = next(
                    (task for task in tasks if module_label.lower().startswith(task.lower())),
                    None,
                )
                if module_task:
                    send_progress(module_task, "Run remediation module")
            nested_item_match = re.search(r"\((\d+)/(\d+)\)\s+generating", message)
            if nested_item_match and file_current:
                send_progress(
                    "Alt text",
                    "Generate captions",
                    int(nested_item_match.group(1)),
                    int(nested_item_match.group(2)),
                    True,
                )
            activity = None
            if not counter_match and not module_match and not nested_item_match:
                activity = _activity_progress(workflow_id, message)
            if activity and file_current:
                send_progress(*activity)
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
