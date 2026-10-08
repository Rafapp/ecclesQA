"""Registry for workflows that Sorcerer is permitted to execute."""
from dataclasses import dataclass


@dataclass(frozen=True)
class JobType:
    script_file: str
    description: str
    extensions: tuple[str, ...]
    needs_output_name: bool = False

    def args(self, source_dir: str, output_dir: str, metadata: dict) -> list[str]:
        if self.needs_output_name:
            return [source_dir, output_dir, str(metadata.get("output_name") or "MHA_Competencies_Output")]
        return [source_dir, output_dir]


JOB_TYPES = {
    "build_syllabus": JobType("build_syllabus.py", "Update Syllabus Formatting", (".docx",)),
    "mha_competencies": JobType("mha_competencies.py", "MHA Competencies", (".csv",), True),
    "docx_remediation": JobType("remediate_docx.py", "Word Accessibility", (".doc", ".docm", ".docx")),
    "pdf_remediation": JobType("remediate_pdf.py", "PDF Accessibility", (".pdf",)),
    "pptx_remediation": JobType("remediate_pptx.py", "PowerPoint Accessibility", (".ppt", ".pptm", ".pptx")),
    "xlsx_remediation": JobType("remediate_xlsx.py", "Excel Workbook Conversion", (".xls", ".xlsb", ".xlsm", ".xlsx")),
}
