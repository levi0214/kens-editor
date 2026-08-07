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

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
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
  contextLines = 4,
): DocumentDiff {
  const parts = diffLines(oldText, newText);
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
    lines: collapseContext(lines, Math.max(0, contextLines)),
    hasChanges,
  };
}
