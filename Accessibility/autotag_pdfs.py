from pathlib import Path
import os
import sys

from adobe.pdfservices.operation.auth.service_principal_credentials import ServicePrincipalCredentials
from adobe.pdfservices.operation.exception.exceptions import ServiceApiException, ServiceUsageException, SdkException
from adobe.pdfservices.operation.pdf_services import PDFServices
from adobe.pdfservices.operation.pdf_services_media_type import PDFServicesMediaType
from adobe.pdfservices.operation.pdfjobs.jobs.autotag_pdf_job import AutotagPDFJob
from adobe.pdfservices.operation.pdfjobs.params.autotag_pdf.autotag_pdf_params import AutotagPDFParams
from adobe.pdfservices.operation.pdfjobs.result.autotag_pdf_result import AutotagPDFResult


def autotag_pdf(pdf_path: Path, output_dir: Path, pdf_services: PDFServices) -> None:
    with open(pdf_path, "rb") as f:
        input_asset = pdf_services.upload(
            input_stream=f,
            mime_type=PDFServicesMediaType.PDF,
        )

    params = AutotagPDFParams(include_renditions=False)

    job = AutotagPDFJob(
        input_asset=input_asset,
        autotag_pdf_params=params,
    )

    location = pdf_services.submit(job)
    result: AutotagPDFResult = pdf_services.get_job_result(
        location,
        AutotagPDFResult,
    )

    output_asset = result.get_result().get_asset()
    stream_asset = pdf_services.get_content(output_asset)

    output_path = output_dir / pdf_path.name  # SAME filename

    with open(output_path, "wb") as out_file:
        out_file.write(stream_asset.get_input_stream())

    print(f"Tagged: {pdf_path.name} -> {output_path}")


def main() -> int:
    client_id = os.environ.get("PDF_SERVICES_CLIENT_ID")
    client_secret = os.environ.get("PDF_SERVICES_CLIENT_SECRET")

    if not client_id or not client_secret:
        print("Missing Adobe credentials.")
        return 1

    credentials = ServicePrincipalCredentials(
        client_id=client_id,
        client_secret=client_secret,
    )

    pdf_services = PDFServices(credentials=credentials)

    input_dir = Path(".")
    output_dir = input_dir / "output"
    output_dir.mkdir(exist_ok=True)

    pdfs = sorted(input_dir.glob("*.pdf"))
    if not pdfs:
        print("No PDF files found.")
        return 0

    failed = 0

    for pdf_path in pdfs:
        try:
            autotag_pdf(pdf_path, output_dir, pdf_services)
        except (ServiceApiException, ServiceUsageException, SdkException, Exception) as e:
            failed += 1
            print(f"Failed: {pdf_path.name} -> {e}")

    print("\nDone.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())