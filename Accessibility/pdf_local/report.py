"""Parse Acrobat-generated accessibility reports."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup

from .core import TARGET_RULES


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

    def interesting_statuses(self, names: tuple[str, ...] = TARGET_RULES) -> list[tuple[str, str]]:
        return [(name, self.status(name)) for name in names if self.status(name) != "Unknown"]

    def failed_rule_names(self) -> list[str]:
        return [rule.name for rule in self.rules.values() if rule.status == "Failed"]


def parse_report(path: Path) -> AccessibilityReport:
    html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "html.parser")

    source_filename = ""
    for dt in soup.find_all("dt"):
        if dt.get_text(" ", strip=True) == "Filename:":
            dd = dt.find_next_sibling("dd")
            source_filename = dd.get_text(" ", strip=True) if dd else ""
            break

    summary: dict[str, int] = {}
    summary_header = soup.find("h2", string="Summary")
    if summary_header:
        ul = summary_header.find_next_sibling("ul")
        if ul:
            for li in ul.find_all("li"):
                text = li.get_text(" ", strip=True)
                if ":" not in text:
                    continue
                name, raw_value = text.split(":", 1)
                try:
                    summary[name.strip()] = int(raw_value.strip())
                except ValueError:
                    continue

    rules: dict[str, RuleResult] = {}
    for tr in soup.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) != 3:
            continue
        name = cells[0].get_text(" ", strip=True)
        status = cells[1].get_text(" ", strip=True)
        description = cells[2].get_text(" ", strip=True)
        if not name or name == "Rule Name":
            continue
        rules[name] = RuleResult(name=name, status=status, description=description)

    return AccessibilityReport(
        source_filename=source_filename,
        report_path=path,
        summary=summary,
        rules=rules,
    )

