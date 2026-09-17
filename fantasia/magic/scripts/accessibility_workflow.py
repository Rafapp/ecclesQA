"""Run recovered accessibility workflows through Magic's event protocol."""

from __future__ import annotations

import os
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
    for path in files:
        shutil.copy2(path, destination / path.name)
    runner.step_info("copy", f"Copied {len(files)} files to {destination}.")
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
    for line in process.stdout:
        message = line.strip()
        if message:
            runner.step_info("remediate", message)
    exit_code = process.wait()
    if exit_code:
        runner.step_error("remediate", f"The accessibility workflow ended with exit code {exit_code}.")
    runner.step_done("remediate")

    runner.step_start("save", "Saving remediated files")
    runner.step_info("save", f"Remediated files are available in {destination}.")
    runner.step_done("save")
    runner.run_done("Accessibility workflow complete.")
