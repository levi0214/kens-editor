import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDocumentDiff,
  countChangedLines,
  splitDocumentDiffLines,
} from "../src/documentDiff.ts";

test("line changes count additions and removals", () => {
  assert.deepEqual(countChangedLines("", "one\ntwo\n"), {
    added: 2,
    removed: 0,
  });
  assert.deepEqual(countChangedLines("one\ntwo\n", "one\nthree\nfour\n"), {
    added: 2,
    removed: 1,
  });
});

test("unchanged documents have no displayed lines", () => {
  assert.deepEqual(buildDocumentDiff("same\n", "same\n"), {
    lines: [],
    hasChanges: false,
  });
});

test("a final newline is not a visible change", () => {
  assert.deepEqual(countChangedLines("same", "same\n"), {
    added: 0,
    removed: 0,
  });
  assert.deepEqual(buildDocumentDiff("same", "same\n"), {
    lines: [],
    hasChanges: false,
  });
});

test("a trailing blank line remains a visible change", () => {
  assert.deepEqual(countChangedLines("same\n", "same\n\n"), {
    added: 1,
    removed: 0,
  });
});

test("a changed line includes word-level highlights", () => {
  const result = buildDocumentDiff("the old ending\n", "the new ending\n");

  assert.equal(result.hasChanges, true);
  assert.deepEqual(
    result.lines.map((line) => line.kind),
    ["removed", "added"],
  );
  assert.equal(
    result.lines[0].spans.some((span) => span.changed && span.text.includes("old")),
    true,
  );
  assert.equal(
    result.lines[1].spans.some((span) => span.changed && span.text.includes("new")),
    true,
  );
});

test("split rows align removed and added lines", () => {
  const diff = buildDocumentDiff("old first\nold second\n", "new first\n");
  const rows = splitDocumentDiffLines(diff.lines);

  assert.equal(rows[0].kind, "lines");
  assert.equal(rows[0].left.kind, "removed");
  assert.equal(rows[0].right.kind, "added");
  assert.equal(rows[1].kind, "lines");
  assert.equal(rows[1].left.kind, "removed");
  assert.equal(rows[1].right, null);
});

test("long unchanged sections collapse around changes", () => {
  const oldLines = Array.from({ length: 24 }, (_, index) => `line ${index + 1}`);
  const newLines = [...oldLines];
  newLines[11] = "changed line";

  const result = buildDocumentDiff(`${oldLines.join("\n")}\n`, `${newLines.join("\n")}\n`, 2);

  assert.equal(result.lines.filter((line) => line.kind === "separator").length, 2);
  assert.equal(result.lines.some((line) => line.text === "line 1"), false);
  assert.equal(result.lines.some((line) => line.text === "line 24"), false);
  assert.equal(result.lines.some((line) => line.text === "line 11"), true);
  assert.equal(result.lines.some((line) => line.text === "line 14"), true);
});

test("full-document diffs keep unchanged sections", () => {
  const oldLines = Array.from({ length: 24 }, (_, index) => `line ${index + 1}`);
  const newLines = [...oldLines];
  newLines[11] = "changed line";

  const result = buildDocumentDiff(
    `${oldLines.join("\n")}\n`,
    `${newLines.join("\n")}\n`,
    null,
  );

  assert.equal(result.lines.some((line) => line.kind === "separator"), false);
  assert.equal(result.lines.some((line) => line.text === "line 1"), true);
  assert.equal(result.lines.some((line) => line.text === "line 24"), true);
});
