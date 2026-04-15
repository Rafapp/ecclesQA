from pathlib import Path
from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.shared import Pt

def first_non_empty_paragraph(doc: Document):
    for para in doc.paragraphs:
        if para.text.strip():
            return para
    return None

def get_or_create_heading1_style(doc: Document):
    # Try common style names first
    candidate_names = [
        "Heading 1",
        "heading 1",
        "Heading1",
        "heading1",
    ]

    for name in candidate_names:
        try:
            return doc.styles[name]
        except KeyError:
            pass

    # Try to find any paragraph style that looks like Heading 1
    for style in doc.styles:
        if style.type == WD_STYLE_TYPE.PARAGRAPH:
            name = (style.name or "").strip().lower().replace("-", "").replace("_", "").replace(" ", "")
            if name in ("heading1", "überschrift1", "titre1", "titulo1", "encabezado1"):
                return style

    # Fallback: create our own paragraph style
    try:
        style = doc.styles.add_style("CustomHeading1", WD_STYLE_TYPE.PARAGRAPH)
    except ValueError:
        style = doc.styles["CustomHeading1"]

    # Basic Heading-1-like formatting
    font = style.font
    font.bold = True
    font.size = Pt(16)

    # Base it on Normal if possible
    try:
        style.base_style = doc.styles["Normal"]
    except KeyError:
        pass

    return style

for docx_path in Path(".").glob("*.docx"):
    if docx_path.name.startswith("~$"):
        continue

    try:
        doc = Document(docx_path)

        # 1) Metadata title = filename without extension
        doc.core_properties.title = docx_path.stem

        # 2) First visible line becomes H1
        first_para = first_non_empty_paragraph(doc)
        if first_para is None:
            print(f"Skipped (empty document): {docx_path.name}")
            continue

        h1_style = get_or_create_heading1_style(doc)
        first_para.style = h1_style

        doc.save(docx_path)
        print(f"Updated: {docx_path.name}")

    except Exception as e:
        print(f"Failed: {docx_path.name} -> {e}")