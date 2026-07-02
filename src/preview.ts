const PREVIEW_MAX_CHARS = 80;

function collapseWhitespace(text: string): string {
  let result = "";
  let lastWasSpace = false;

  for (const ch of text) {
    if (/\s/.test(ch)) {
      if (result.length > 0 && !lastWasSpace) {
        result += " ";
        lastWasSpace = true;
      }
    } else {
      result += ch;
      lastWasSpace = false;
    }
  }

  return result.trimEnd();
}

export function previewFromText(text: string): string {
  const collapsed = collapseWhitespace(text);

  if (collapsed.length === 0) {
    return "(empty)";
  }

  const chars = [...collapsed];
  if (chars.length <= PREVIEW_MAX_CHARS) {
    return collapsed;
  }

  return `${chars.slice(0, PREVIEW_MAX_CHARS).join("")}…`;
}
