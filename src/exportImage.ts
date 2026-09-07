// Render the editor's plain text into a single tall PNG card, like a
// photograph of a page. No markdown, no parsing — the text is drawn as-is.
//
// The default is a narrow portrait card that reads well on a phone: a stable
// content column (~400px) with a slightly larger baseline font.

const FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_CONTENT_WIDTH = 400;
const LINE_HEIGHT = 1.6;
const PAD_X = 40;
const PAD_Y = 64;
const BG = "#faf9f6";
const FG = "#1c1b19";

export interface ExportImageOptions {
  // Content text column width in CSS pixels. Default 400 (narrow, mobile).
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

// Wrap a single physical line to `maxWidth`. Breaks at the last space when one
// is available (Latin prose), otherwise breaks anywhere (CJK). This mirrors the
// editor's `pre-wrap` + `overflow-wrap: break-word`.
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
    const space = line.lastIndexOf(" ");
    if (space > 0) {
      out.push(line.slice(0, space).trimEnd());
      line = line.slice(space + 1) + ch;
    } else {
      out.push(line.trimEnd());
      line = ch;
    }
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
