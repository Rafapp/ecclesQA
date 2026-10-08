"""Build a term syllabus from the current Eccles template and prior materials.

The template owns all formatting. Instructor content is copied into its
matching section without copying source headings or leaving template prompts.
"""
from __future__ import annotations

import copy
import re
import sys
from datetime import date
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import magic_runner as runner

SECTION_MAP = {
    "course description": "Course Description",
    "course objectives": "Course Outcomes and Objectives",
    "goals and objectives": "Course Outcomes and Objectives",
    "textbook": "Required Readings", "e book": "Required Readings",
    "materials required for this course are": "Required Readings",
    "course grades": "Course Requirements", "our role": "Course Overview",
    "your responsibilities": "Course Overview", "methods of instruction": "Instructional Methods",
    "attendance": "Course Policies", "pre class readings": "Instructional Methods",
    "chapter hw assignments": "Instructional Methods", "exams": "Instructional Methods",
    "weekly homework assignments from the textbook": "Instructional Methods",
    "informational interview paper": "Instructional Methods", "quizzes": "Instructional Methods",
    "midterm and final exams": "Instructional Methods", "discussion boards": "Instructional Methods",
    "teams": "Instructional Methods", "course schedule": "Preliminary Course Schedule",
    "required materials": "Required Readings", "communication": "Course Policies",
    "evaluation": "Course Requirements", "assignments": "Instructional Methods",
    "mha program competencies": "MHA Program Competencies",
    "university and eccles school policies": "University Policies",
}

def normalized(text): return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
def nonempty_paragraphs(document): return [p for p in document.paragraphs if p.text.strip()]
def target_paragraphs(document): return {normalized(p.text): p for p in nonempty_paragraphs(document)}
def heading_level(p):
    match = re.fullmatch(r"Heading (\d+)", p.style.name or "")
    return int(match.group(1)) if match else None

def find_input_files(folder):
    files = sorted(folder.glob("*.docx"))
    template = next((p for p in files if "template" in p.name.lower()), None)
    schedule = next((p for p in files if "schedule" in p.name.lower()), None)
    syllabus = next((p for p in files if p not in {template, schedule}), None)
    if not template or not syllabus: raise ValueError("Expected a template and an instructor syllabus (.docx files).")
    return template, syllabus, schedule

def clear_paragraph(p):
    for child in list(p._p):
        if child.tag != qn("w:pPr"): p._p.remove(child)

def replace_text(p, value): clear_paragraph(p); p.add_run(value)

def bold_colon_lead_in(paragraph):
    """Apply the template's label/value convention without formatting the value."""
    match = re.match(r"^([^:\n]+:)(\s*)(.*)$", paragraph.text.strip())
    if not match:
        return
    clear_paragraph(paragraph)
    label = paragraph.add_run(match.group(1))
    label.bold = True
    paragraph.add_run(match.group(2) + match.group(3))

def format_instructor_information(template):
    """Format all template metadata rows consistently for every course."""
    anchor = target_paragraphs(template).get(normalized("Instructor Information"))
    if anchor is None:
        return
    paragraphs = template.paragraphs
    start = next(i for i, p in enumerate(paragraphs) if p._p is anchor._p) + 1
    for paragraph in paragraphs[start:]:
        level = heading_level(paragraph)
        if level is not None and level <= (heading_level(anchor) or 2):
            break
        bold_colon_lead_in(paragraph)
def first_matching_source_value(source, label):
    pattern = re.compile(rf"^{re.escape(label)}\s*:\s*(.+)$", re.I)
    for p in nonempty_paragraphs(source):
        match = pattern.match(p.text.strip())
        if match: return match.group(1).strip()
    return None

def set_known_fields(template, source, course_title, term_label):
    targets = target_paragraphs(template)
    values = {"course number and name": course_title, "instructor name": first_matching_source_value(source, "Professor"),
        "email university of utah email": first_matching_source_value(source, "E-mail"),
        "office hours hours by appointment": first_matching_source_value(source, "Office Hours")}
    for key, value in values.items():
        if value and key in targets:
            existing = targets[key].text
            replace_text(targets[key], re.sub(r"\{[^}]+\}", value, existing, count=1) if "{" in existing else value)
    if term_label:
        for p in template.paragraphs:
            if normalized(p.text).startswith("spring summer fall semester"):
                replace_text(p, f"{term_label} {{Meeting Days}}, {{Time-Time}}; {{Room/Zoom}}")
                break
    format_instructor_information(template)

def insert_after(anchor, element):
    anchor._p.addnext(copy.deepcopy(element)); return anchor._p.getnext()

def prototype(template, anchor, as_heading):
    ps = template.paragraphs
    start = next(i for i, p in enumerate(ps) if p._p is anchor._p) + 1
    base = heading_level(next(p for p in ps if p._p is anchor._p)) or 9
    for p in ps[start:]:
        level = heading_level(p)
        if level is not None and level <= base: break
        if as_heading and level == 3 and "{" in p.text: return p
        if not as_heading and level is None and p.text.strip(): return p
    return None

def add_text_after(anchor, text, template, as_heading=False):
    sample = prototype(template, anchor, as_heading)
    p = OxmlElement("w:p")
    if sample is not None and sample._p.pPr is not None: p.append(copy.deepcopy(sample._p.pPr))
    elif as_heading:
        ppr, style = OxmlElement("w:pPr"), OxmlElement("w:pStyle")
        style.set(qn("w:val"), "Heading3"); ppr.append(style); p.append(ppr)
    r, t = OxmlElement("w:r"), OxmlElement("w:t"); t.text = text; r.append(t); p.append(r)
    return type("Anchor", (), {"_p": insert_after(anchor, p)})()

def insert_table_after(anchor, table):
    cloned = prepared_table_clone(table)
    anchor._p.addnext(cloned); inserted = anchor._p.getnext()
    return type("Anchor", (), {"_p": inserted})()

def prepared_table_clone(table):
    cloned = copy.deepcopy(table._tbl)
    for properties in cloned.iter(qn("w:rPr")):
        for tag in ("w:rFonts", "w:sz", "w:szCs", "w:color", "w:shd"):
            child = properties.find(qn(tag))
            if child is not None:
                properties.remove(child)
    jc = cloned.tblPr.first_child_found_in("w:jc")
    if jc is None: jc = OxmlElement("w:jc"); cloned.tblPr.append(jc)
    jc.set(qn("w:val"), "center")
    return cloned

def remove_replaced_prompts(template, anchor):
    ps = template.paragraphs
    anchor_paragraph = next(p for p in ps if p._p is anchor._p)
    start, base = ps.index(anchor_paragraph) + 1, heading_level(anchor_paragraph) or 9
    for p in list(ps[start:]):
        other = heading_level(p)
        if other is not None and other <= base: break
        text = p.text.strip()
        if ("{" in text and "}" in text) or text.startswith("[If you are teaching"):
            p._element.getparent().remove(p._element)

def remove_section_examples(template, anchor):
    """Remove template-only outcome examples, even when they have no braces."""
    if normalized(anchor.text) != normalized("Course Outcomes and Objectives"):
        return
    ps = template.paragraphs
    start = next(i for i, p in enumerate(ps) if p._p is anchor._p) + 1
    for p in list(ps[start:]):
        if heading_level(p) is not None and heading_level(p) <= 2:
            break
        if (p.style.name == "List Paragraph" or
                normalized(p.text).startswith("by the end of this course you will be able to")):
            p._element.getparent().remove(p._element)

def source_blocks(document):
    blocks, current = [], None
    for p in nonempty_paragraphs(document):
        raw, key = p.text.strip(), normalized(p.text.strip().rstrip(":"))
        if key in SECTION_MAP:
            if current: blocks.append(current)
            current = {"label": key, "source_title": raw.rstrip(":"), "paragraphs": []}
        elif current: current["paragraphs"].append(p)
    if current: blocks.append(current)
    return blocks

def add_source_body_after(anchor, source_paragraph, template, nested=False):
    """Use template body styling while retaining only semantic emphasis."""
    text = source_paragraph.text.strip()
    sample = prototype(template, anchor, False)
    p = OxmlElement("w:p")
    if source_paragraph.style.name == "List Paragraph":
        ppr, style = OxmlElement("w:pPr"), OxmlElement("w:pStyle")
        style.set(qn("w:val"), "ListParagraph"); ppr.append(style); p.append(ppr)
    elif sample is not None and sample._p.pPr is not None:
        p.append(copy.deepcopy(sample._p.pPr))
    if nested and source_paragraph.style.name != "List Paragraph":
        ppr = p.find(qn("w:pPr"))
        if ppr is None:
            ppr = OxmlElement("w:pPr"); p.insert(0, ppr)
        indent = ppr.find(qn("w:ind"))
        if indent is None:
            indent = OxmlElement("w:ind"); ppr.append(indent)
        heading_indent = template.styles["Heading 3"].paragraph_format.left_indent
        indent.set(qn("w:left"), str(heading_indent.twips if heading_indent else 0))
    run_text = "".join(run.text for run in source_paragraph.runs)
    # python-docx excludes hyperlink/field text from Paragraph.runs. Preserve
    # complete visible text rather than silently removing an email or URL.
    if run_text != text:
        run, value = OxmlElement("w:r"), OxmlElement("w:t")
        value.text = text; run.append(value); p.append(run)
        return type("Anchor", (), {"_p": insert_after(anchor, p)})()
    colon = text.find(":")
    for source_run in source_paragraph.runs:
        if not source_run.text:
            continue
        run, value = OxmlElement("w:r"), OxmlElement("w:t")
        if source_run.text.startswith(" ") or source_run.text.endswith(" "):
            value.set(qn("xml:space"), "preserve")
        value.text = source_run.text
        rpr = OxmlElement("w:rPr")
        # A bold lead-in ending with a colon is semantic; its description is not.
        before_colon = colon >= 0 and text.find(source_run.text) <= colon
        if source_run.bold and (colon < 0 or before_colon): rpr.append(OxmlElement("w:b"))
        if source_run.italic: rpr.append(OxmlElement("w:i"))
        if source_run.underline: rpr.append(OxmlElement("w:u"))
        if len(rpr): run.append(rpr)
        run.append(value); p.append(run)
    return type("Anchor", (), {"_p": insert_after(anchor, p)})()

def source_is_subheading(paragraph):
    text = paragraph.text.strip()
    first = next((run for run in paragraph.runs if run.text.strip()), None)
    return bool(first and first.bold and len(text) <= 90 and "http" not in text.lower() and
                text.count(".") <= 1 and len(text.split()) <= 12)

def transfer_block(template, anchor, block, target_label):
    remove_replaced_prompts(template, anchor); remove_section_examples(template, anchor); last = anchor
    nested = False
    if normalized(block["source_title"]) != normalized(target_label):
        last = add_text_after(last, block["source_title"].rstrip("- "), template, True)
        nested = True
    for source_paragraph in block["paragraphs"]:
        if source_is_subheading(source_paragraph):
            last = add_text_after(last, source_paragraph.text.strip().rstrip(":-"), template, True)
            nested = True
        else:
            last = add_source_body_after(last, source_paragraph, template, nested)
    return last

def table_text(table): return " ".join(c.text for row in table.rows for c in row.cells).lower()
def schedule_tables(document):
    result = []
    for table in document.tables:
        header = " ".join(c.text.lower() for c in table.rows[0].cells) if table.rows else ""
        if any(w in header for w in ("week", "date", "session")) and "topic" in header: result.append(table)
    return result
def grade_table(document):
    return next((t for t in document.tables if "% of grade" in table_text(t) or ("total" in table_text(t) and "grade" in table_text(t) and "point" in table_text(t))), None)

def write_cell_from_source(target_cell, source_cell):
    target = target_cell.paragraphs[0]
    clear_paragraph(target)
    for run in source_cell.paragraphs[0].runs if source_cell.paragraphs else []:
        new = target.add_run(run.text)
        new.bold, new.italic, new.underline = run.bold, run.italic, run.underline
    if not target.runs:
        target.add_run(source_cell.text)
    for paragraph in target_cell.paragraphs[1:]:
        paragraph._element.getparent().remove(paragraph._element)

def table_has_header(table):
    header = " ".join(cell.text.lower() for cell in table.rows[0].cells) if table.rows else ""
    return any(word in header for word in ("week", "date", "session", "item", "topic", "assignment"))

def build_template_table(target, sources):
    """Keep the template grid, widths, and fonts; transfer only source values."""
    header_source = sources[0].rows[0]
    for destination, source in zip(target.rows[0].cells, header_source.cells):
        write_cell_from_source(destination, source)
    row_prototype = copy.deepcopy(target.rows[1]._tr if len(target.rows) > 1 else target.rows[0]._tr)
    for row in list(target.rows[1:]):
        row._tr.getparent().remove(row._tr)
    for table_index, source_table in enumerate(sources):
        start = 1 if table_index == 0 and table_has_header(source_table) else 0
        for source_row in source_table.rows[start:]:
            new_row = copy.deepcopy(row_prototype)
            target._tbl.append(new_row)
            destination_row = target.rows[-1]
            for destination, source in zip(destination_row.cells, source_row.cells):
                write_cell_from_source(destination, source)

def normalize_table_emphasis(table):
    """Remove source fonts and geometry overrides while keeping B/I/U emphasis."""
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.name = None
                    run.font.size = None
                    run.font.color.rgb = None
                    run._element.rPr.rFonts.set(qn("w:ascii"), "") if run._element.rPr is not None and run._element.rPr.rFonts is not None else None

def replace_schedule_table(template, schedule, separate_schedule=False):
    # A separately supplied schedule may continue in tables that repeat no
    # header row. In a self-contained syllabus, select only schedule tables.
    sources = schedule.tables if separate_schedule else schedule_tables(schedule)
    if not sources: raise ValueError("Could not find a schedule table in the supplied syllabus materials.")
    anchor = target_paragraphs(template).get(normalized("Preliminary Course Schedule"))
    if anchor is None: raise ValueError("The template does not contain a Preliminary Course Schedule heading.")
    remove_replaced_prompts(template, anchor)
    target = next((t for t in template.tables if "week" in table_text(t) and "topic" in table_text(t)), None)
    if target is not None and len(target.columns) == len(sources[0].columns):
        build_template_table(target, sources)
        target._tbl.getparent().replace(target._tbl, prepared_table_clone(target))
    else:
        if target is not None:
            for source in sources:
                target._tbl.addprevious(prepared_table_clone(source))
            target._tbl.getparent().remove(target._tbl)
        else:
            last = anchor
            for source in sources:
                last = insert_table_after(last, source)

def copy_grade_table(template, source):
    table, anchor = grade_table(source), target_paragraphs(template).get(normalized("Course Requirements"))
    if not table or not anchor: return False
    remove_replaced_prompts(template, anchor); insert_table_after(anchor, table); return True

def remove_empty_heading_paragraphs(template):
    for paragraph in list(template.paragraphs):
        if heading_level(paragraph) is not None and not paragraph.text.strip():
            # Word stores section breaks on otherwise blank paragraphs. Removing
            # one would discard the template's page orientation and letterhead.
            if paragraph._p.pPr is not None and paragraph._p.pPr.sectPr is not None:
                paragraph.style = template.styles["Normal"]
            else:
                paragraph._element.getparent().remove(paragraph._element)

def highlight_blocks(blocks):
    # Source paragraphs are unchanged; this retains the prior review handoff behavior.
    return len(blocks)

def save_summary(path, course_title, mapped, unmatched, gaps):
    mapped = list(dict.fromkeys(mapped))
    lines = ["# Syllabus transfer summary", "", f"Course: {course_title}", "", "## Moved sections", ""]
    lines += [f"- {x}" for x in mapped] or ["- None"]
    lines += ["", "## Needs placement or confirmation", ""] + [f"- {x}" for x in unmatched + gaps]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

def main():
    if len(sys.argv) != 3: runner.run_error("Usage: build_syllabus.py <source_folder> <output_folder>")
    source_folder, output_folder = map(Path, sys.argv[1:])
    runner.step_start("scan", "Checking syllabus source files")
    try: template_path, syllabus_path, schedule_path = find_input_files(source_folder)
    except ValueError as error: runner.step_error("scan", str(error))
    runner.step_info("scan", "Using the template, instructor syllabus, and available schedule.", items=[template_path.name, syllabus_path.name, schedule_path.name if schedule_path else "Schedule in syllabus"], confirm=True); runner.step_done("scan")
    runner.step_start("transfer", "Moving source content into template-styled sections")
    template, source, schedule = Document(template_path), Document(syllabus_path), Document(schedule_path) if schedule_path else Document(syllabus_path)
    source_ps, term_source = nonempty_paragraphs(source), schedule
    match = re.search(r"\b(Spring|Summer|Fall|Winter)\s+(20\d{2})\b", "\n".join(p.text for p in nonempty_paragraphs(term_source)), re.I)
    label, term = (f"{match.group(1).title()} {match.group(2)}", f"{match.group(2)} {match.group(1).title()}") if match else (None, "Term TBD")
    course_title = source_ps[0].text.strip() if source_ps else "Course"; set_known_fields(template, source, course_title, label)
    targets, mapped, unmatched = target_paragraphs(template), [], []
    for block in source_blocks(source):
        if block["label"] == "course schedule":
            # The schedule heading and table are handled as one replacement below.
            continue
        anchor = targets.get(normalized(SECTION_MAP[block["label"]]))
        if anchor is None: unmatched.append(block); continue
        transfer_block(template, anchor, block, SECTION_MAP[block["label"]]); mapped.append(block["label"])
    if copy_grade_table(template, source): mapped.append("grade breakdown table")
    replace_schedule_table(template, schedule, bool(schedule_path)); mapped.append("course schedule")
    remove_empty_heading_paragraphs(template)
    runner.step_info("transfer", f"Moved {len(mapped)} section(s), including grading and schedule tables where supplied."); runner.step_done("transfer")
    runner.step_start("flag", "Preparing review handoff")
    gaps = ["Phone number and office location were not provided in the instructor syllabus."]
    if not schedule_path: gaps.insert(0, "No separate updated schedule was supplied; the schedule at the end of the instructor syllabus was used.")
    output_folder.mkdir(parents=True, exist_ok=True)
    instructor = (first_matching_source_value(source, "Professor") or "Instructor").split(",")[0].split()[-1]
    code = re.search(r"([A-Za-z]+)\s*(\d{4})", course_title); course_code = f"{code.group(1).upper()} {code.group(2)}" if code else "Course"
    output = output_folder / f"{course_code} - {instructor} - {term} Syllabus {date.today():%m%d%Y}.docx"; template.save(output)
    source_output = output_folder / f"{syllabus_path.stem} - items needing placement.docx"; source.save(source_output)
    summary = output_folder / "syllabus-transfer-summary.md"; save_summary(summary, course_title, mapped, [b["label"] for b in unmatched], gaps)
    runner.step_done("flag"); runner.step_start("save", "Saving syllabus and handoff files")
    runner.step_info("save", "Created the draft syllabus, source copy, and transfer summary.", items=[output.name, source_output.name, summary.name]); runner.step_done("save"); runner.run_done("Syllabus draft created.")

if __name__ == "__main__": main()
