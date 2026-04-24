"""Configuration helpers for the cloud PDF workflow."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CREDENTIALS_FILE = REPO_ROOT / ".secrets" / "pdf_cloud.env"
REQUIRED_KEYS = ("PDF_SERVICES_CLIENT_ID", "PDF_SERVICES_CLIENT_SECRET")


class CredentialsError(RuntimeError):
    """Raised when Adobe PDF Services credentials are missing or invalid."""


@dataclass(frozen=True)
class CloudCredentials:
    client_id: str
    client_secret: str
    source: Path | None = None


def _strip_quotes(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        return text[1:-1].strip()
    return text


def _parse_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        raise CredentialsError(
            f"Credentials file not found: {path}\n"
            "Create it from .secrets/pdf_cloud.env.example."
        )

    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(
        path.read_text(encoding="utf-8", errors="ignore").splitlines(),
        start=1,
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise CredentialsError(
                f"Invalid line {line_number} in {path}: expected KEY=value syntax."
            )
        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not key:
            raise CredentialsError(
                f"Invalid line {line_number} in {path}: missing variable name."
            )
        values[key] = _strip_quotes(raw_value)
    return values


def load_credentials(credentials_file: Path | None = None) -> CloudCredentials:
    source_path = credentials_file or DEFAULT_CREDENTIALS_FILE
    values: dict[str, str] = {}
    source: Path | None = None

    if source_path.exists():
        values.update(_parse_env_file(source_path))
        source = source_path

    for key in REQUIRED_KEYS:
        env_value = os.getenv(key)
        if env_value and key not in values:
            values[key] = env_value.strip()

    missing = [key for key in REQUIRED_KEYS if not values.get(key)]
    if missing:
        names = ", ".join(missing)
        raise CredentialsError(
            f"Missing Adobe PDF Services credentials: {names}\n"
            f"Put them in {source_path} as KEY=value lines. "
            "That path is gitignored for local-only secrets."
        )

    return CloudCredentials(
        client_id=values["PDF_SERVICES_CLIENT_ID"],
        client_secret=values["PDF_SERVICES_CLIENT_SECRET"],
        source=source,
    )
