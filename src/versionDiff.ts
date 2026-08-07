import { diffLines, diffWordsWithSpace } from "diff";

export type VersionDiffKind = "context" | "removed" | "added" | "gap";

export interface VersionDiffSegment {
  text: string;
  changed: boolean;
}

export interface VersionDiffRow {
  kind: VersionDiffKind;
  oldLine?: number;
  newLine?: number;
  segments: VersionDiffSegment[];
}

export interface VersionDiff {
  rows: VersionDiffRow[];
  added: number;
  removed: number;
}

const CONTEXT_LINES = 3;

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const lines = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function plainSegments(text: string): VersionDiffSegment[] {
  return [{ text, changed: false }];
}

function changedSegments(
  oldText: string,
  newText: string,
): { oldSegments: VersionDiffSegment[]; newSegments: VersionDiffSegment[] } {
  const parts = diffWordsWithSpace(oldText, newText);
  const oldSegments: VersionDiffSegment[] = [];
  const newSegments: VersionDiffSegment[] = [];

  for (const part of parts) {
    if (!part.added) {
      oldSegments.push({ text: part.value, changed: Boolean(part.removed) });
    }
    if (!part.removed) {
      newSegments.push({ text: part.value, changed: Boolean(part.added) });
    }
  }

  return { oldSegments, newSegments };
}

function collapseContext(rows: VersionDiffRow[]): VersionDiffRow[] {
  const changedIndexes = rows
    .map((row, index) => (row.kind === "context" ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) {
    return [];
  }

  const visible = new Set<number>();
  for (const index of changedIndexes) {
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(rows.length - 1, index + CONTEXT_LINES);
    for (let cursor = start; cursor <= end; cursor += 1) {
      visible.add(cursor);
    }
  }

  const result: VersionDiffRow[] = [];
  let previous = -1;
  for (const index of [...visible].sort((left, right) => left - right)) {
    if (previous >= 0 && index > previous + 1) {
      result.push({ kind: "gap", segments: [] });
    }
    result.push(rows[index]);
    previous = index;
  }
  return result;
}

export function createVersionDiff(oldText: string, newText: string): VersionDiff {
  const parts = diffLines(oldText, newText);
  const rows: VersionDiffRow[] = [];
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;

  for (let index = 0; index < parts.length; ) {
    const part = parts[index];
    if (!part.added && !part.removed) {
      for (const line of splitLines(part.value)) {
        rows.push({
          kind: "context",
          oldLine,
          newLine,
          segments: plainSegments(line),
        });
        oldLine += 1;
        newLine += 1;
      }
      index += 1;
      continue;
    }

    const removedLines: string[] = [];
    const addedLines: string[] = [];
    while (index < parts.length && (parts[index].added || parts[index].removed)) {
      const changedPart = parts[index];
      const lines = splitLines(changedPart.value);
      if (changedPart.removed) {
        removedLines.push(...lines);
      } else {
        addedLines.push(...lines);
      }
      index += 1;
    }

    if (removedLines.length === 1 && addedLines.length === 1) {
      const segments = changedSegments(removedLines[0], addedLines[0]);
      rows.push({
        kind: "removed",
        oldLine,
        segments: segments.oldSegments,
      });
      rows.push({
        kind: "added",
        newLine,
        segments: segments.newSegments,
      });
    } else {
      for (let offset = 0; offset < removedLines.length; offset += 1) {
        rows.push({
          kind: "removed",
          oldLine: oldLine + offset,
          segments: plainSegments(removedLines[offset]),
        });
      }
      for (let offset = 0; offset < addedLines.length; offset += 1) {
        rows.push({
          kind: "added",
          newLine: newLine + offset,
          segments: plainSegments(addedLines[offset]),
        });
      }
    }

    oldLine += removedLines.length;
    newLine += addedLines.length;
    removed += removedLines.length;
    added += addedLines.length;
  }

  return { rows: collapseContext(rows), added, removed };
}
