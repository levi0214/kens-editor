// Render the editor's plain text into a single tall PNG card, like a
// photograph of a page. No markdown, no parsing — the text is drawn as-is.

const FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const FONT_SIZE = 18;
const LINE_HEIGHT = 1.6;
const PAD_X = 48;
const PAD_Y = 56;
const BG = "#faf9f6";
const FG = "#1c1b19";

export interface ExportImageOptions {
  // Content column width in "ch" (the width of "0" in the font). Default 72.
  widthCh?: number;
  // Pixel density. Higher = sharper, bigger file. Default 2.
  scale?: number;
}

export async function textToPngBytes(
  text: string,
  options: ExportImageOptions = {},
): Promise<Uint8Array> {
  const widthCh = options.widthCh ?? 72;
  const scale = options.scale ?? 2;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D is not available");
  }

  ctx.font = font(FONT_SIZE);
  const charWidth = ctx.measureText("0").width || FONT_SIZE * 0.6;
  const maxWidth = Math.ceil(widthCh * charWidth);
  const lineHeight = FONT_SIZE * LINE_HEIGHT;

  const lines = wrapText(text, maxWidth, (s) => ctx.measureText(s).width);

  const width = maxWidth + PAD_X * 2;
  const height = Math.max(PAD_Y * 2, PAD_Y * 2 + lines.length * lineHeight);

  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  // Draw in CSS pixels, not device pixels.
  ctx.scale(scale, scale);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  ctx.font = font(FONT_SIZE);
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

  return new Uint8Array(await blob.arrayBuffer());
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
