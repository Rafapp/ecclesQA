"""Parse Adobe PDF Services accessibility checker JSON reports."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .core import TARGET_RULES, clean_text


@dataclass(frozen=True)
class RuleResult:
    name: str
    status: str
    description: str


@dataclass
class AccessibilityReport:
    source_filename: str
    report_path: Path
    summary: dict[str, int]
    rules: dict[str, RuleResult]

    def status(self, name: str) -> str:
        rule = self.rules.get(name)
        return rule.status if rule else "Unknown"

    def interesting_statuses(
        self,
        names: tuple[str, ...] = TARGET_RULES,
    ) -> list[tuple[str, str]]:
        return [(name, self.status(name)) for name in names if self.status(name) != "Unknown"]

    def failed_rule_names(self) -> list[str]:
        return [rule.name for rule in self.rules.values() if rule.status == "Failed"]


_CANONICAL_RULES = {clean_text(name).lower(): name for name in TARGET_RULES}
_NAME_KEYS = ("ruleName", "name", "label", "title", "checkName", "rule")
_STATUS_KEYS = ("status", "state", "result", "outcome", "checkStatus", "value")
_DESCRIPTION_KEYS = ("description", "details", "message", "help", "reason")


def parse_report(path: Path) -> AccessibilityReport:
    payload = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    return AccessibilityReport(
        source_filename=_find_source_filename(payload),
        report_path=path,
        summary=_find_summary(payload),
        rules=_extract_rules(payload),
    )


def _canonical_rule_name(value: str | None) -> str:
    flat = clean_text(value).strip(" :")
    if not flat:
        return ""
    return _CANONICAL_RULES.get(flat.lower(), flat)


def _normalize_status(value: Any) -> str:
    if isinstance(value, bool):
        return "Passed" if value else "Failed"
    flat = clean_text(str(value))
    lowered = flat.lower()
    if not lowered:
        return ""
    if "needs manual" in lowered or "manual check" in lowered or lowered.startswith("review"):
        return "Needs manual check"
    if lowered.startswith("pass") or lowered == "true":
        return "Passed"
    if lowered.startswith("fail") or lowered == "false":
        return "Failed"
    if lowered.startswith("skip"):
        return "Skipped"
    if lowered.startswith("unknown"):
        return "Unknown"
    return flat[:1].upper() + flat[1:]


def _status_from_value(value: Any) -> str:
    if isinstance(value, dict):
        for key in _STATUS_KEYS:
            if key in value:
                status = _status_from_value(value[key])
                if status:
                    return status
        return ""
    if isinstance(value, list):
        for item in value:
            status = _status_from_value(item)
            if status:
                return status
        return ""
    return _normalize_status(value)


def _description_from_value(value: Any) -> str:
    if isinstance(value, dict):
        for key in _DESCRIPTION_KEYS:
            if key in value:
                description = clean_text(str(value[key]))
                if description:
                    return description
        return ""
    return ""


def _extract_rules(payload: Any) -> dict[str, RuleResult]:
    results: dict[str, RuleResult] = {}

    def store(name: str | None, status: str, description: str = "") -> None:
        canonical = _canonical_rule_name(name)
        if not canonical or not status:
            return
        existing = results.get(canonical)
        if existing is None or existing.status == "Unknown":
            results[canonical] = RuleResult(
                name=canonical,
                status=status,
                description=description,
            )

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                canonical = _canonical_rule_name(str(key))
                if canonical in TARGET_RULES:
                    store(canonical, _status_from_value(value), _description_from_value(value))

            name = ""
            for key in _NAME_KEYS:
                if key in node:
                    name = _canonical_rule_name(str(node[key]))
                    if name:
                        break
            if name:
                status = ""
                for key in _STATUS_KEYS:
                    if key in node:
                        status = _status_from_value(node[key])
                        if status:
                            break
                if status:
                    description = ""
                    for key in _DESCRIPTION_KEYS:
                        if key in node:
                            description = clean_text(str(node[key]))
                            if description:
                                break
                    store(name, status, description)

            for value in node.values():
                walk(value)
            return

        if isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    return results


def _find_source_filename(payload: Any) -> str:
    filename_keys = ("fileName", "filename", "sourceFile", "documentName", "inputFile")

    def walk(node: Any) -> str:
        if isinstance(node, dict):
            for key in filename_keys:
                if key in node:
                    value = clean_text(str(node[key]))
                    if value:
                        return value
            for value in node.values():
                found = walk(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = walk(item)
                if found:
                    return found
        return ""

    return walk(payload)


def _find_summary(payload: Any) -> dict[str, int]:
    summary_keys = {
        "passed": "Passed",
        "failed": "Failed",
        "needsmanualcheck": "Needs manual check",
        "needs_manual_check": "Needs manual check",
        "needmanualcheck": "Needs manual check",
        "warning": "Needs manual check",
    }

    def extract(node: Any) -> dict[str, int]:
        if not isinstance(node, dict):
            return {}
        found: dict[str, int] = {}
        for key, value in node.items():
            if not isinstance(value, int):
                continue
            normalized_key = "".join(ch for ch in str(key).lower() if ch.isalnum() or ch == "_")
            label = summary_keys.get(normalized_key)
            if label:
                found[label] = value
        return found

    def walk(node: Any) -> dict[str, int]:
        if isinstance(node, dict):
            direct = extract(node)
            if direct:
                return direct
            for value in node.values():
                found = walk(value)
                if found:
                    return found
        elif isinstance(node, list):
            for item in node:
                found = walk(item)
                if found:
                    return found
        return {}

    return walk(payload)
