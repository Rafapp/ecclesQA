"""Per-folder job manifest for resumable processing.

A file called ``ecclesqa_manifest.json`` is written next to the files being
processed. It records:
  - Each file's status (in_progress/done/failed) so a crashed or interrupted
    run can skip already-finished work on the next launch.
  - Each file type's processing status (in_progress/complete) so the harness
    can resume from where it left off when processing multiple file types
    (docx, pdf, pptx, xlsx).

Writes are atomic (write to a temp file then os.replace) so a sudden power cut
cannot corrupt an existing manifest.
"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_FILENAME = "ecclesqa_manifest.json"
_SCHEMA = 2


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobManifest:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._data: dict = {"schema": _SCHEMA, "files": {}, "stages": {}}
        if path.exists():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(raw, dict) and raw.get("schema") == _SCHEMA:
                    self._data = raw
                    # Ensure stages section exists for backward compatibility
                    if "stages" not in self._data:
                        self._data["stages"] = {}
            except (json.JSONDecodeError, OSError):
                pass

    @classmethod
    def for_folder(cls, folder: Path) -> "JobManifest":
        return cls(folder / MANIFEST_FILENAME)

    def is_done(self, file: Path) -> bool:
        return self._data["files"].get(self._key(file), {}).get("status") == "done"

    def mark_stage(self, file: Path, stage: str) -> None:
        entry = self._data["files"].setdefault(self._key(file), {})
        entry.update(status="in_progress", last_stage=stage, updated_at=_utcnow())
        entry.pop("error", None)
        self._flush()

    def mark_done(self, file: Path) -> None:
        entry = self._data["files"].setdefault(self._key(file), {})
        entry.update(status="done", last_stage="finalize", completed_at=_utcnow())
        entry.pop("error", None)
        self._flush()

    def mark_failed(self, file: Path, error: str) -> None:
        entry = self._data["files"].setdefault(self._key(file), {})
        entry.update(status="failed", error=str(error)[:500], updated_at=_utcnow())
        self._flush()

    def mark_filetype_started(self, filetype: str) -> None:
        """Mark that processing of a file type (e.g., 'docx', 'pdf', 'pptx', 'xlsx') has started."""
        entry = self._data["stages"].setdefault(filetype, {})
        entry.update(status="in_progress", started_at=_utcnow())
        entry.pop("completed_at", None)
        self._flush()

    def mark_filetype_complete(self, filetype: str) -> None:
        """Mark that all files of a given type have been successfully processed."""
        entry = self._data["stages"].setdefault(filetype, {})
        entry.update(status="complete", completed_at=_utcnow())
        self._flush()

    def is_filetype_complete(self, filetype: str) -> bool:
        """Check if a file type has already been completely processed."""
        return self._data["stages"].get(filetype, {}).get("status") == "complete"

    def _key(self, file: Path) -> str:
        return str(file.resolve())

    def _flush(self) -> None:
        fd, tmp_str = tempfile.mkstemp(
            dir=self._path.parent, suffix=".tmp", prefix=".ecclesqa_manifest_"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(self._data, fh, indent=2)
        except Exception:
            try:
                os.unlink(tmp_str)
            except OSError:
                pass
            raise
        os.replace(tmp_str, self._path)
