interface ProcessedLine {
  text: string;
  isHeader?: boolean;
}

function line(text: string, isHeader = false): ProcessedLine {
  return isHeader ? { text, isHeader: true } : { text };
}

function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function isHorizontalRule(line: string): boolean {
  return /^\s*([-*_])\1{2,}\s*$/.test(line);
}

function skipLine(line: string): boolean {
  return /^\s*\|?[\s|:-]+\|[\s|:-]+\|?\s*$/.test(line);
}

function processLine(raw: string): ProcessedLine | null {
  if (skipLine(raw)) {
    return null;
  }

  if (isHorizontalRule(raw)) {
    return line("---");
  }

  const header = raw.match(/^(\s*)(#{1,6}\s+)(.*)$/);
  if (header) {
    return line(header[1] + header[2] + stripInline(header[3]), true);
  }

  const blockquote = raw.match(/^(\s*)((?:>\s*)+)(.*)$/);
  if (blockquote) {
    return line(`${blockquote[1]}> ${stripInline(blockquote[3])}`);
  }

  const task = raw.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
  if (task) {
    return line(`${task[1]}- [${task[2]}] ${stripInline(task[3])}`);
  }

  const unordered = raw.match(/^(\s*)[-*+]\s+(.*)$/);
  if (unordered) {
    return line(`${unordered[1]}- ${stripInline(unordered[2])}`);
  }

  const ordered = raw.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (ordered) {
    return line(`${ordered[1]}${ordered[2]}. ${stripInline(ordered[3])}`);
  }

  if (/^\s*\|/.test(raw)) {
    const text = raw
      .replace(/^\s*\|\s?/, "")
      .replace(/\s?\|\s*$/, "")
      .replace(/\s*\|\s*/g, "  ");
    return line(stripInline(text));
  }

  return line(stripInline(raw));
}

function assembleLines(lines: ProcessedLine[]): string[] {
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];

    if (!current.isHeader) {
      output.push(current.text);
      continue;
    }

    if (output.length > 0 && output[output.length - 1] !== "") {
      output.push("");
    }

    output.push(current.text);

    const next = lines[index + 1];
    if (next && next.text !== "" && !next.isHeader) {
      output.push("");
    }
  }

  return output;
}

function normalizeBlankLines(lines: string[]): string {
  const normalized: string[] = [];
  let blankRun = 0;

  for (const entry of lines.map((line) => line.trimEnd())) {
    if (entry.length === 0) {
      blankRun += 1;
      if (blankRun <= 2) {
        normalized.push("");
      }
      continue;
    }

    blankRun = 0;
    normalized.push(entry);
  }

  return normalized.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

function readCodeBlock(lines: string[], start: number): { block: string[]; next: number } {
  let index = start + 1;
  const block: string[] = [];

  while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
    block.push(lines[index]);
    index += 1;
  }

  if (index < lines.length) {
    index += 1;
  }

  return { block, next: index };
}

export function unmarkdown(text: string): string {
  const sourceLines = text.split("\n");
  const processed: ProcessedLine[] = [];
  let index = 0;

  while (index < sourceLines.length) {
    if (sourceLines[index].trimStart().startsWith("```")) {
      const { block, next } = readCodeBlock(sourceLines, index);
      for (const codeLine of block) {
        processed.push(line(codeLine));
      }
      index = next;
      continue;
    }

    const result = processLine(sourceLines[index]);
    if (result) {
      processed.push(result);
    }

    index += 1;
  }

  return normalizeBlankLines(assembleLines(processed));
}
