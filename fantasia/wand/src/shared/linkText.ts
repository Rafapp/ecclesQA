const FILE_EXTENSION_PATTERN = /\.(?:pdf|docx?|pptx?|xlsx?|csv|txt|rtf|odt|ods|odp|html?|zip)\s*$/i;
const COPY_SUFFIX_PATTERN = /\s*(?:[-–—_]\s*)?(?:copy(?:\s*\d+)?|\(\s*\d+\s*\)|[-_]\s*\d+)\s*$/i;

export function cleanNondescriptLinkText(value: string): string {
  let cleaned = decodeLinkText(value.trim());
  if (!cleaned) {
    return "";
  }

  cleaned = cleaned.replace(/\\_/g, "_");
  cleaned = cleaned.replace(/_+/g, " ");
  cleaned = stripFileExtensions(cleaned);
  cleaned = cleaned.replace(COPY_SUFFIX_PATTERN, "");
  cleaned = cleaned.replace(/\s+[-–—]\s*/g, " - ");
  cleaned = cleaned.replace(/\s*[-–—]\s+/g, " - ");
  cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
  cleaned = cleaned.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

export function getLinkTextSuggestion(value: string): string | null {
  const original = value.trim();
  if (!original || looksLikeUrl(original) || isGenericLinkText(original)) {
    return null;
  }

  const cleaned = cleanNondescriptLinkText(original);
  return cleaned && cleaned !== original ? cleaned : null;
}

function stripFileExtensions(value: string): string {
  let cleaned = value;
  for (let index = 0; index < 3; index++) {
    const next = cleaned.replace(FILE_EXTENSION_PATTERN, "").trim();
    if (next === cleaned) {
      break;
    }
    cleaned = next;
  }
  return cleaned;
}

function decodeLinkText(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksLikeUrl(value: string): boolean {
  return /^(?:https?|ftp|mailto):/i.test(value) ||
    /^www\./i.test(value) ||
    /[a-z0-9.-]+\.(?:com|org|edu|gov|net)(?:[/?#:]|$)/i.test(value);
}

function isGenericLinkText(value: string): boolean {
  return /^(?:click here|here|link|learn more|more|read more|download)$/i.test(value.trim());
}
