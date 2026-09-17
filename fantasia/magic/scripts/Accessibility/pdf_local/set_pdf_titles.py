from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_DOWNLOADS = Path(r"C:\Users\u1592528\Downloads")
EXIFTOOL = "exiftool"


def print_header(downloads_dir: Path) -> None:
    print("==========================================")
    print("PDF title update job starting")
    print(f'Target folder: "{downloads_dir}"')
    print(f'Using tool: "{EXIFTOOL}"')
    print("==========================================")
    print()


def update_pdf_title(pdf_path: Path, index: int, total: int) -> bool:
    title = pdf_path.stem

    print(f'[{index}/{total}] Preparing to update "{pdf_path.name}"')
    print(f'Setting PDF Title metadata to "{title}"...')

    result = subprocess.run(
        [EXIFTOOL, "-overwrite_original", f"-Title={title}", str(pdf_path)],
        capture_output=True,
        text=True,
        check=False,
    )

    if result.returncode != 0:
        print(f'WARNING: exiftool reported a problem while updating "{pdf_path.name}".')
        if result.stderr.strip():
            print(result.stderr.strip())
        elif result.stdout.strip():
            print(result.stdout.strip())
        print()
        return False

    print(f'Successfully updated title metadata for "{pdf_path.name}".')
    if result.stdout.strip():
        print(result.stdout.strip())
    print()
    return True


def main() -> int:
    print_header(DEFAULT_DOWNLOADS)

    exiftool_path = shutil.which(EXIFTOOL)
    if exiftool_path is None:
        print("ERROR: Could not find exiftool on PATH.")
        print("Install exiftool or update the EXIFTOOL constant in this script.")
        return 1

    if not DEFAULT_DOWNLOADS.exists():
        print("ERROR: The Downloads folder was not found.")
        print(f'Expected path: "{DEFAULT_DOWNLOADS}"')
        return 1

    print("Scanning for PDF files...")
    pdf_files = sorted(DEFAULT_DOWNLOADS.glob("*.pdf"))

    if not pdf_files:
        print(f'No PDF files were found in "{DEFAULT_DOWNLOADS}".')
        print("Nothing to update.")
        return 0

    print(f"Found {len(pdf_files)} PDF file(s) to update.")
    print()

    failed = 0

    for index, pdf_path in enumerate(pdf_files, start=1):
        if not update_pdf_title(pdf_path, index, len(pdf_files)):
            failed += 1

    print("==========================================")
    print("PDF title update job complete")
    print(f'Processed {len(pdf_files)} PDF file(s) in "{DEFAULT_DOWNLOADS}"')
    print(f"Successful updates: {len(pdf_files) - failed}")
    print(f"Failed updates: {failed}")
    print("==========================================")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
