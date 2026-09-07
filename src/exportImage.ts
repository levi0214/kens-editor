// Render the editor's plain text into a single tall PNG card, like a
// photograph of a page. No markdown, no parsing — the text is drawn as-is.
//
// The card is a phone column, not a desktop page. Shared full-width on a
// phone, 18px type at 360px wide reads as 18px. Wider cards shrink the type.

const FONT =
  'ui-monospace, SFMono-Regular, Menlo, "PingFang SC", "Hiragino Sans GB", Monaco, Consolas, monospace';
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_CONTENT_WIDTH = 320;
const LINE_HEIGHT = 1.6;
const PAD_X = 20;
const PAD_Y = 32;
const BG = "#faf9f6";
const FG = "#1c1b19";

export interface ExportImageOptions {
  // Content text column width in CSS pixels. Default 320 (~18 CJK at 18px).
  contentWidth?: number;
  // Font size in CSS pixels. Default 18.
  fontSize?: number;
  // Pixel density. Higher = sharper, bigger file. Default 2.
  scale?: number;
}

export interface RenderedImage {
  // Object URL for preview. The caller revokes it when done.
  url: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export async function renderTextToPng(
  text: string,
  options: ExportImageOptions = {},
): Promise<RenderedImage> {
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
  const contentWidth = options.contentWidth ?? DEFAULT_CONTENT_WIDTH;
  const scale = options.scale ?? 2;
  const maxWidth = Math.ceil(contentWidth);
  const lineHeight = fontSize * LINE_HEIGHT;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D is not available");
  }

  // The wrap measures glyph widths, so the font must be set first or the
  // measurement uses the canvas default (10px sans-serif) and the lines are
  // computed far too narrow, then drawn wide off the right edge.
  ctx.font = font(fontSize);
  const lines = wrapText(text, maxWidth, (s) => ctx.measureText(s).width);
  const width = maxWidth + PAD_X * 2;
  const height = Math.max(PAD_Y * 2, PAD_Y * 2 + lines.length * lineHeight);

  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  // Draw in CSS pixels, not device pixels.
  ctx.scale(scale, scale);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  ctx.font = font(fontSize);
  ctx.fillStyle = FG;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  lines.forEach((line, index) => {
    if (line === "") {
      return;
    }
    ctx.fillText(line, PAD_X, PAD_Y + index * lineHeight + lineHeight / 2);
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) {
    throw new Error("Failed to render PNG");
  }

  return {
    url: URL.createObjectURL(blob),
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  };
}

function font(px: number): string {
  return `${px}px ${FONT}`;
}

// Trailing punctuation stays on the previous line; opening punctuation
// follows the next. Cheap kinsoku so a card doesn't start a line with 。.
const NO_START = "，。、；：！？,.;:!?)…—）】》」』”’]}";
const NO_END = "「『【（《“‘([{";

function stickPunctuation(left: string, right: string): [string, string] {
  const head = Array.from(left);
  const tail = Array.from(right);
  while (tail.length > 0 && head.length > 0 && NO_START.includes(tail[0])) {
    head.push(tail.shift() as string);
  }
  while (head.length > 1 && NO_END.includes(head[head.length - 1])) {
    tail.unshift(head.pop() as string);
  }
  return [head.join(""), tail.join("")];
}

function isLatinWordChar(ch: string): boolean {
  return /[A-Za-z0-9]/.test(ch);
}

// Wrap a single physical line to `maxWidth`. Latin overflow breaks at the last
// space so words stay whole. CJK overflow breaks here — it must not rewind to
// a space sitting earlier on the line, or "际很 low" becomes a stranded 际很.
function wrapLine(
  raw: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  if (raw === "") {
    return [""];
  }

  const chars = Array.from(raw);
  const out: string[] = [];
  let line = "";

  for (const ch of chars) {
    if (line === "") {
      line = ch;
      continue;
    }
    if (measure(line + ch) <= maxWidth) {
      line += ch;
      continue;
    }
    if (NO_START.includes(ch)) {
      line += ch;
      continue;
    }
    const space = isLatinWordChar(ch) ? line.lastIndexOf(" ") : -1;
    let left: string;
    let right: string;
    if (space > 0) {
      left = line.slice(0, space).trimEnd();
      right = line.slice(space + 1) + ch;
    } else {
      left = line.trimEnd();
      right = ch;
    }
    [left, right] = stickPunctuation(left, right);
    out.push(left);
    line = right;
  }

  if (line.trimEnd() !== "") {
    out.push(line.trimEnd());
  }
  return out;
}

// Split the document into rendered lines. Blank physical lines become blank
// rows (paragraph breaks), all-whitespace lines collapse to blank.
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") {
      out.push("");
    } else {
      out.push(...wrapLine(raw, maxWidth, measure));
    }
  }
  return out;
}
