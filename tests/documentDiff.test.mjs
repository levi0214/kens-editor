import assert from "node:assert/strict";
import test from "node:test";
import { buildDocumentDiff } from "../src/documentDiff.ts";

test("unchanged documents have no displayed lines", () => {
  assert.deepEqual(buildDocumentDiff("same\n", "same\n"), {
    lines: [],
    hasChanges: false,
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
