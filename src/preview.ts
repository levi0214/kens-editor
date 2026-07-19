const PREVIEW_MAX_CHARS = 360;

function cleanPreview(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/^(?:[ \t]*\n)+/, "")
    .trimEnd();
}

export function previewFromText(text: string): string {
  const preview = cleanPreview(text);

  if (preview.length === 0) {
    return "(empty)";
  }

  const chars = [...preview];
  if (chars.length <= PREVIEW_MAX_CHARS) {
    return preview;
  }

  return `${chars.slice(0, PREVIEW_MAX_CHARS).join("")}…`;
}
