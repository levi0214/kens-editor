import assert from "node:assert/strict";
import test from "node:test";
import { wrapText } from "../src/exportImage.ts";

// Fake measure: each character is 10px wide.
const measure = (s) => s.length * 10;

test("wraps long prose at word boundaries", () => {
  const lines = wrapText("hello world goodbye", 150, measure);
  assert.deepEqual(lines, ["hello world", "goodbye"]);
});

test("keeps a short line intact", () => {
  assert.deepEqual(wrapText("hello", 150, measure), ["hello"]);
});

test("breaks CJK anywhere with no spaces", () => {
  const lines = wrapText("你好世界你好世界", 40, measure);
  assert.deepEqual(lines, ["你好世界", "你好世界"]);
});

test("preserves paragraph breaks", () => {
  assert.deepEqual(wrapText("one\n\ntwo", 200, measure), [
    "one",
    "",
    "two",
  ]);
});

test("collapses whitespace-only lines to blank", () => {
  assert.deepEqual(wrapText("one\n   \ntwo", 200, measure), [
    "one",
    "",
    "two",
  ]);
});

test("keeps leading indentation", () => {
  assert.deepEqual(wrapText("    code", 200, measure), ["    code"]);
});

test("empty document yields a single blank row", () => {
  assert.deepEqual(wrapText("", 200, measure), [""]);
});

test("a word longer than the width overflows into fragments", () => {
  const lines = wrapText("abcdefghij", 30, measure);
  assert.deepEqual(lines, ["abc", "def", "ghi", "j"]);
});
