const FILE_EXTENSION_PATTERN = /\.(?:avif|bmp|gif|heic|jpe?g|png|svg|tiff?|webp)\s*$/i;
const COPY_SUFFIX_PATTERN = /\s*(?:copy(?:\s*\d+)?|\(\s*\d+\s*\))\s*$/i;

export function getFilenameLabelSuggestion(value: string): string | null {
  const original = value.trim();
  if (!original) {
    return null;
  }

  let cleaned = decodeValue(original).split(/[?#]/, 1)[0];
  cleaned = cleaned.split(/[\\/]/).pop() ?? cleaned;
  cleaned = cleaned.replace(FILE_EXTENSION_PATTERN, "");
  cleaned = cleaned.replace(/\\_/g, "_");
  cleaned = cleaned.replace(/[_-]+/g, " ");
  cleaned = cleaned.replace(COPY_SUFFIX_PATTERN, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^\p{Ll}/u, (character) => character.toUpperCase());

  return cleaned && cleaned !== original ? cleaned : null;
}

function decodeValue(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) {
    return value;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
