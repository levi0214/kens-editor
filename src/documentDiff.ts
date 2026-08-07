import { diffLines, diffWords } from "diff";

export type DocumentDiffLineKind =
  | "context"
  | "added"
  | "removed"
  | "separator";

export interface DocumentDiffSpan {
  text: string;
  changed: boolean;
}

export interface DocumentDiffLine {
  kind: DocumentDiffLineKind;
  oldNumber?: number;
  newNumber?: number;
  text?: string;
  spans?: DocumentDiffSpan[];
}

export interface DocumentDiff {
  lines: DocumentDiffLine[];
  hasChanges: boolean;
}

export type SplitDocumentDiffRow =
  | { kind: "separator" }
  | {
      kind: "lines";
      left: DocumentDiffLine | null;
      right: DocumentDiffLine | null;
    };

export interface DocumentLineChanges {
  added: number;
  removed: number;
}

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function normalizeForDiff(value: string): string {
  return value === "" || value.endsWith("\n") ? value : `${value}\n`;
}

export function countChangedLines(
  oldText: string,
  newText: string,
): DocumentLineChanges {
  let added = 0;
  let removed = 0;

  for (const part of diffLines(
    normalizeForDiff(oldText),
    normalizeForDiff(newText),
  )) {
    const lineCount = splitLines(part.value).length;
    if (part.added) {
      added += lineCount;
    } else if (part.removed) {
      removed += lineCount;
    }
  }

  return { added, removed };
}

export function splitDocumentDiffLines(
  lines: DocumentDiffLine[],
): SplitDocumentDiffRow[] {
  const rows: SplitDocumentDiffRow[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (line.kind === "separator") {
      rows.push({ kind: "separator" });
      index += 1;
      continue;
    }

    if (line.kind === "context") {
      rows.push({ kind: "lines", left: line, right: line });
      index += 1;
      continue;
    }

    if (line.kind === "added") {
      rows.push({ kind: "lines", left: null, right: line });
      index += 1;
      continue;
    }

    const removed: DocumentDiffLine[] = [];
    while (index < lines.length && lines[index].kind === "removed") {
      removed.push(lines[index]);
      index += 1;
    }

    const added: DocumentDiffLine[] = [];
    while (index < lines.length && lines[index].kind === "added") {
      added.push(lines[index]);
      index += 1;
    }

    const rowCount = Math.max(removed.length, added.length);
    for (let row = 0; row < rowCount; row += 1) {
      rows.push({
        kind: "lines",
        left: removed[row] ?? null,
        right: added[row] ?? null,
      });
    }
  }

  return rows;
}

function wordSpans(
  oldText: string,
  newText: string,
): { removed: DocumentDiffSpan[]; added: DocumentDiffSpan[] } {
  const parts = diffWords(oldText, newText);
  const removed: DocumentDiffSpan[] = [];
  const added: DocumentDiffSpan[] = [];

  for (const part of parts) {
    if (!part.added) {
      removed.push({ text: part.value, changed: Boolean(part.removed) });
    }
    if (!part.removed) {
      added.push({ text: part.value, changed: Boolean(part.added) });
    }
  }

  return { removed, added };
}

function collapseContext(
  lines: DocumentDiffLine[],
  contextLines: number,
): DocumentDiffLine[] {
  const output: DocumentDiffLine[] = [];

  for (let index = 0; index < lines.length; ) {
    if (lines[index].kind !== "context") {
      output.push(lines[index]);
      index += 1;
      continue;
    }

    const start = index;
    while (index < lines.length && lines[index].kind === "context") {
      index += 1;
    }

    const run = lines.slice(start, index);
    const changeBefore = start > 0;
    const changeAfter = index < lines.length;

    if (!changeBefore && !changeAfter) {
      continue;
    }

    if (!changeBefore) {
      if (run.length > contextLines) {
        output.push({ kind: "separator" });
      }
      output.push(...run.slice(-contextLines));
      continue;
    }

    if (!changeAfter) {
      output.push(...run.slice(0, contextLines));
      if (run.length > contextLines) {
        output.push({ kind: "separator" });
      }
      continue;
    }

    if (run.length <= contextLines * 2) {
      output.push(...run);
      continue;
    }

    output.push(...run.slice(0, contextLines));
    output.push({ kind: "separator" });
    output.push(...run.slice(-contextLines));
  }

  return output;
}

export function buildDocumentDiff(
  oldText: string,
  newText: string,
  contextLines: number | null = 4,
): DocumentDiff {
  const parts = diffLines(normalizeForDiff(oldText), normalizeForDiff(newText));
  const lines: DocumentDiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  let hasChanges = false;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const partLines = splitLines(part.value);

    if (part.removed) {
      hasChanges = true;
      const next = parts[index + 1];
      const nextLines = next?.added ? splitLines(next.value) : [];

      if (partLines.length === 1 && nextLines.length === 1) {
        const spans = wordSpans(partLines[0], nextLines[0]);
        lines.push({
          kind: "removed",
          oldNumber,
          text: partLines[0],
          spans: spans.removed,
        });
        lines.push({
          kind: "added",
          newNumber,
          text: nextLines[0],
          spans: spans.added,
        });
        oldNumber += 1;
        newNumber += 1;
        index += 1;
        continue;
      }

      for (const text of partLines) {
        lines.push({ kind: "removed", oldNumber, text });
        oldNumber += 1;
      }
      continue;
    }

    if (part.added) {
      hasChanges = true;
      for (const text of partLines) {
        lines.push({ kind: "added", newNumber, text });
        newNumber += 1;
      }
      continue;
    }

    for (const text of partLines) {
      lines.push({ kind: "context", oldNumber, newNumber, text });
      oldNumber += 1;
      newNumber += 1;
    }
  }

  return {
    lines:
      contextLines === null
        ? lines
        : collapseContext(lines, Math.max(0, contextLines)),
    hasChanges,
  };
}
