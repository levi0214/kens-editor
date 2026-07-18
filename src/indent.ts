const INDENT = "  ";

export type IndentEdit = {
  rangeStart: number;
  rangeEnd: number;
  replacement: string;
  selectionStart: number;
  selectionEnd: number;
};

type LineRange = {
  start: number;
  end: number;
  lineStarts: number[];
};

function selectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): LineRange {
  const start = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lastSelectedPosition =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const lastLineStart = value.lastIndexOf("\n", lastSelectedPosition - 1) + 1;
  const nextLineBreak = value.indexOf("\n", lastLineStart);
  const end = nextLineBreak === -1 ? value.length : nextLineBreak;
  const lineStarts = [start];

  let lineBreak = value.indexOf("\n", start);
  while (lineBreak !== -1 && lineBreak + 1 <= lastLineStart) {
    lineStarts.push(lineBreak + 1);
    lineBreak = value.indexOf("\n", lineBreak + 1);
  }

  return { start, end, lineStarts };
}

export function indentSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): IndentEdit {
  const lines = selectedLines(value, selectionStart, selectionEnd);
  let replacement = value.slice(lines.start, lines.end);

  for (let index = lines.lineStarts.length - 1; index >= 0; index -= 1) {
    const offset = lines.lineStarts[index] - lines.start;
    replacement =
      replacement.slice(0, offset) + INDENT + replacement.slice(offset);
  }

  const addedBefore = (position: number) =>
    lines.lineStarts.filter((lineStart) => lineStart < position).length *
    INDENT.length;

  return {
    rangeStart: lines.start,
    rangeEnd: lines.end,
    replacement,
    selectionStart: selectionStart + addedBefore(selectionStart),
    selectionEnd: selectionEnd + addedBefore(selectionEnd),
  };
}

export function outdentSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): IndentEdit | null {
  const lines = selectedLines(value, selectionStart, selectionEnd);
  const removals = lines.lineStarts.flatMap((lineStart) => {
    const count = value.startsWith(INDENT, lineStart)
      ? INDENT.length
      : value[lineStart] === " "
        ? 1
        : 0;

    return count === 0 ? [] : [{ start: lineStart, count }];
  });

  if (removals.length === 0) {
    return null;
  }

  let replacement = value.slice(lines.start, lines.end);
  for (let index = removals.length - 1; index >= 0; index -= 1) {
    const removal = removals[index];
    const offset = removal.start - lines.start;
    replacement =
      replacement.slice(0, offset) +
      replacement.slice(offset + removal.count);
  }

  const adjustedPosition = (position: number) => {
    let removed = 0;

    for (const removal of removals) {
      if (position <= removal.start) {
        break;
      }
      if (position < removal.start + removal.count) {
        return removal.start - removed;
      }
      removed += removal.count;
    }

    return position - removed;
  };

  return {
    rangeStart: lines.start,
    rangeEnd: lines.end,
    replacement,
    selectionStart: adjustedPosition(selectionStart),
    selectionEnd: adjustedPosition(selectionEnd),
  };
}
