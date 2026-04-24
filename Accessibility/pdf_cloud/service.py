"""Adobe PDF Services API wrapper for the cloud PDF workflow."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from adobe.pdfservices.operation.auth.service_principal_credentials import (
    ServicePrincipalCredentials,
)
from adobe.pdfservices.operation.exception.exceptions import (
    ServiceApiException,
    ServiceUsageException,
    SdkException,
)
from adobe.pdfservices.operation.pdf_services import PDFServices
from adobe.pdfservices.operation.pdf_services_media_type import PDFServicesMediaType
from adobe.pdfservices.operation.pdfjobs.jobs.autotag_pdf_job import (
    AutotagPDFJob,
    AutotagPDFParams,
)
from adobe.pdfservices.operation.pdfjobs.jobs.ocr_pdf_job import OCRPDFJob, OCRParams
from adobe.pdfservices.operation.pdfjobs.jobs.pdf_accessibility_checker_job import (
    PDFAccessibilityCheckerJob,
    PDFAccessibilityCheckerParams,
)
from adobe.pdfservices.operation.pdfjobs.jobs.remove_protection_job import (
    RemoveProtectionJob,
    RemoveProtectionParams,
)
from adobe.pdfservices.operation.pdfjobs.params.ocr_pdf.ocr_supported_locale import (
    OCRSupportedLocale,
)
from adobe.pdfservices.operation.pdfjobs.params.ocr_pdf.ocr_supported_type import (
    OCRSupportedType,
)
from adobe.pdfservices.operation.pdfjobs.result.autotag_pdf_result import AutotagPDFResult
from adobe.pdfservices.operation.pdfjobs.result.ocr_pdf_result import OCRPDFResult
from adobe.pdfservices.operation.pdfjobs.result.pdf_accessibility_checker_result import (
    PDFAccessibilityCheckerResult,
)
from adobe.pdfservices.operation.pdfjobs.result.remove_protection_result import (
    RemoveProtectionResult,
)

from .config import CloudCredentials


class CloudPdfError(RuntimeError):
    """Raised when an Adobe PDF Services operation fails."""


@dataclass(frozen=True)
class AccessibilityCheckArtifacts:
    pdf_path: Path
    report_path: Path


@dataclass(frozen=True)
class AutotagArtifacts:
    pdf_path: Path
    report_path: Path | None


class AdobePdfServicesClient:
    def __init__(self, credentials: CloudCredentials) -> None:
        self._credentials = credentials
        self._pdf_services = PDFServices(
            credentials=ServicePrincipalCredentials(
                client_id=credentials.client_id,
                client_secret=credentials.client_secret,
            )
        )

    def remove_protection(self, input_path: Path, output_path: Path, password: str) -> Path:
        input_asset = self._upload_pdf(input_path)
        params = RemoveProtectionParams(password=password)
        job = RemoveProtectionJob(input_asset, params)
        result = self._submit_job(job, RemoveProtectionResult, "remove protection")
        self._write_asset(result.get_asset(), output_path)
        return output_path

    def ocr_pdf(
        self,
        input_path: Path,
        output_path: Path,
        *,
        locale: str = "en-US",
    ) -> Path:
        try:
            locale_enum = OCRSupportedLocale(locale)
        except ValueError as exc:
            raise CloudPdfError(f"Unsupported OCR locale: {locale}") from exc

        input_asset = self._upload_pdf(input_path)
        params = OCRParams(
            ocr_locale=locale_enum,
            ocr_type=OCRSupportedType.SEARCHABLE_IMAGE_EXACT,
        )
        job = OCRPDFJob(input_asset, ocr_pdf_params=params)
        result = self._submit_job(job, OCRPDFResult, "OCR")
        self._write_asset(result.get_asset(), output_path)
        return output_path

    def autotag_pdf(
        self,
        input_path: Path,
        output_path: Path,
        *,
        report_path: Path | None = None,
        shift_headings: bool = False,
    ) -> AutotagArtifacts:
        input_asset = self._upload_pdf(input_path)
        params = AutotagPDFParams(
            shift_headings=shift_headings,
            generate_report=report_path is not None,
        )
        job = AutotagPDFJob(input_asset, autotag_pdf_params=params)
        result = self._submit_job(job, AutotagPDFResult, "auto-tagging")
        self._write_asset(result.get_tagged_pdf(), output_path)

        saved_report: Path | None = None
        if report_path is not None:
            try:
                report_asset = result.get_report()
            except Exception:
                report_asset = None
            if report_asset is not None:
                self._write_asset(report_asset, report_path)
                saved_report = report_path

        return AutotagArtifacts(pdf_path=output_path, report_path=saved_report)

    def check_accessibility(
        self,
        input_path: Path,
        pdf_output_path: Path,
        report_path: Path,
        *,
        page_start: int | None = None,
        page_end: int | None = None,
    ) -> AccessibilityCheckArtifacts:
        input_asset = self._upload_pdf(input_path)
        params = None
        if page_start is not None or page_end is not None:
            params = PDFAccessibilityCheckerParams(
                page_start=page_start,
                page_end=page_end,
            )
        job = PDFAccessibilityCheckerJob(
            input_asset,
            pdf_accessibility_checker_params=params,
        )
        result = self._submit_job(job, PDFAccessibilityCheckerResult, "accessibility check")
        self._write_asset(result.get_asset(), pdf_output_path)
        self._write_asset(result.get_report(), report_path)
        return AccessibilityCheckArtifacts(
            pdf_path=pdf_output_path,
            report_path=report_path,
        )

    def _upload_pdf(self, input_path: Path):
        try:
            with input_path.open("rb") as fh:
                return self._pdf_services.upload(
                    input_stream=fh.read(),
                    mime_type=PDFServicesMediaType.PDF,
                )
        except OSError as exc:
            raise CloudPdfError(f"Could not read {input_path}") from exc
        except (ServiceApiException, ServiceUsageException, SdkException) as exc:
            raise CloudPdfError(f"Upload failed for {input_path.name}: {exc}") from exc

    def _submit_job(self, job, result_type, operation_name: str):
        try:
            location = self._pdf_services.submit(job)
            response = self._pdf_services.get_job_result(location, result_type)
            return response.get_result()
        except (ServiceApiException, ServiceUsageException, SdkException) as exc:
            raise CloudPdfError(f"Adobe {operation_name} failed: {exc}") from exc

    def _write_asset(self, asset, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.unlink(missing_ok=True)
        try:
            stream_asset = self._pdf_services.get_content(asset)
            with output_path.open("wb") as fh:
                fh.write(stream_asset.get_input_stream())
        except OSError as exc:
            raise CloudPdfError(f"Could not write {output_path}") from exc
        except (ServiceApiException, ServiceUsageException, SdkException) as exc:
            raise CloudPdfError(f"Download failed for {output_path.name}: {exc}") from exc
