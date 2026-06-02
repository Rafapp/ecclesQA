"""Quick accessibility issue report for UDOIT/Canvas CSV exports."""
from __future__ import annotations

from io import StringIO
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
CANVAS_CSV = BASE_DIR / "Canvas issues.csv"
FILE_CSV = BASE_DIR / "file_issues.csv"
OUT_DIR = BASE_DIR / "issue_report_output"


def read_csv(path: Path) -> pd.DataFrame:
    """Read these exports, including the one row with unescaped quotes around alt."""
    text = path.read_text(encoding="utf-8-sig")
    text = text.replace('Image does not include an "alt" attribute', "Image does not include an 'alt' attribute")
    try:
        return pd.read_csv(StringIO(text))
    except pd.errors.ParserError:
        text = text.replace('an "alt" attribute', "an 'alt' attribute")
        return pd.read_csv(StringIO(text))


def numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(
        series.astype(str).str.replace(",", "", regex=False).str.replace("%", "", regex=False),
        errors="coerce",
    ).fillna(0)


def save_bar(series: pd.Series, title: str, xlabel: str, output: Path, horizontal: bool = True) -> None:
    fig, ax = plt.subplots(figsize=(11, 6))
    if horizontal:
        series.sort_values().plot(kind="barh", ax=ax, color="#2563eb")
        ax.set_xlabel(xlabel)
    else:
        series.plot(kind="bar", ax=ax, color="#2563eb")
        ax.set_ylabel(xlabel)
        ax.tick_params(axis="x", labelrotation=20)
    ax.set_title(title)
    ax.grid(axis="x" if horizontal else "y", alpha=0.25)
    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)


def save_pie(series: pd.Series, title: str, output: Path) -> None:
    fig, ax = plt.subplots(figsize=(7, 7))
    series.plot(kind="pie", ax=ax, autopct="%1.1f%%", startangle=90)
    ax.set_ylabel("")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)


def analyze_canvas(canvas: pd.DataFrame) -> tuple[list[str], dict[str, Path]]:
    for col in ("Active", "Fixed", "Resolved", "Scanned Courses"):
        canvas[col] = numeric(canvas[col])
    canvas["Total Observed"] = canvas["Active"] + canvas["Fixed"] + canvas["Resolved"]
    canvas["Completion Rate"] = (canvas["Fixed"] + canvas["Resolved"]) / canvas["Total Observed"].replace(0, pd.NA)

    status_totals = canvas[["Active", "Fixed", "Resolved"]].sum().sort_values(ascending=False)
    severity_totals = canvas.groupby("Issue Severity")["Active"].sum().sort_values(ascending=False)
    top_active = canvas.nlargest(10, "Active").set_index("Issue")["Active"]
    top_completion = canvas[canvas["Total Observed"] >= 100].nlargest(5, "Completion Rate")

    charts = {
        "canvas_status_totals": OUT_DIR / "canvas_status_totals.png",
        "canvas_active_by_severity": OUT_DIR / "canvas_active_by_severity.png",
        "canvas_top_active_issues": OUT_DIR / "canvas_top_active_issues.png",
    }
    save_pie(status_totals, "Canvas Issues by Status", charts["canvas_status_totals"])
    save_bar(severity_totals, "Active Canvas Issues by Severity", "Active issues", charts["canvas_active_by_severity"], horizontal=False)
    save_bar(top_active, "Top 10 Active Canvas Issues", "Active issues", charts["canvas_top_active_issues"])

    lines = [
        "Canvas/course-formatting issues",
        f"- Active: {int(status_totals.get('Active', 0)):,}",
        f"- Fixed: {int(status_totals.get('Fixed', 0)):,}",
        f"- Resolved: {int(status_totals.get('Resolved', 0)):,}",
        f"- Total observed status count: {int(status_totals.sum()):,}",
        f"- Largest active category: {top_active.index[0]} ({int(top_active.iloc[0]):,})",
        f"- Active issues by severity: "
        + ", ".join(f"{idx}={int(val):,}" for idx, val in severity_totals.items()),
    ]
    if not top_completion.empty:
        best = top_completion.iloc[0]
        lines.append(
            f"- Best completion rate among 100+ issue groups: {best['Issue']} "
            f"({best['Completion Rate']:.1%})"
        )
    return lines, charts


def analyze_files(files: pd.DataFrame) -> tuple[list[str], dict[str, Path]]:
    for col in ("Total", "Scanned Courses"):
        files[col] = numeric(files[col])
    files["File Type"] = files["Issue"].str.extract(r"^([A-Z]+)\s+-", expand=False).fillna("Other")

    type_totals = files.groupby("File Type")["Total"].sum().sort_values(ascending=False)
    top_file_issues = files.nlargest(10, "Total").set_index("Issue")["Total"]
    scanned_by_type = files.groupby("File Type")["Scanned Courses"].max().sort_values(ascending=False)

    charts = {
        "file_totals_by_type": OUT_DIR / "file_totals_by_type.png",
        "file_top_issues": OUT_DIR / "file_top_issues.png",
        "file_scanned_courses_by_type": OUT_DIR / "file_scanned_courses_by_type.png",
    }
    save_bar(type_totals, "File Issues by File Type", "Total issues", charts["file_totals_by_type"], horizontal=False)
    save_bar(top_file_issues, "Top 10 File Issues", "Total issues", charts["file_top_issues"])
    save_bar(scanned_by_type, "Courses Affected by File Type", "Scanned courses", charts["file_scanned_courses_by_type"], horizontal=False)

    lines = [
        "",
        "File-related issues",
        f"- Total file issues: {int(files['Total'].sum()):,}",
        f"- Most affected file type: {type_totals.index[0]} ({int(type_totals.iloc[0]):,})",
        f"- Largest file issue: {top_file_issues.index[0]} ({int(top_file_issues.iloc[0]):,})",
        "- File issues by type: " + ", ".join(f"{idx}={int(val):,}" for idx, val in type_totals.items()),
    ]
    return lines, charts


def main() -> int:
    OUT_DIR.mkdir(exist_ok=True)

    canvas = read_csv(CANVAS_CSV)
    files = read_csv(FILE_CSV)

    canvas_lines, canvas_charts = analyze_canvas(canvas)
    file_lines, file_charts = analyze_files(files)

    lines = [
        "Accessibility Issue Report",
        f"Source: {CANVAS_CSV.name}, {FILE_CSV.name}",
        "",
        *canvas_lines,
        *file_lines,
        "",
        "Charts",
        *[f"- {path}" for path in {**canvas_charts, **file_charts}.values()],
    ]

    report_path = OUT_DIR / "summary.txt"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nSaved summary: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
