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

test("keeps trailing punctuation on the previous line", () => {
  const lines = wrapText("一二三四五。", 50, measure);
  assert.deepEqual(lines, ["一二三四五。"]);
});

test("moves opening punctuation onto the next line", () => {
  const lines = wrapText("他说「你好啊", 30, measure);
  assert.deepEqual(lines, ["他说", "「你好", "啊"]);
});

test("CJK overflow does not rewind to an earlier space before Latin", () => {
  const lines = wrapText("一二三四五六七八实际很 low的感觉一二三四", 50, measure);
  assert.deepEqual(lines, [
    "一二三四五",
    "六七八实际",
    "很 low",
    "的感觉一二",
    "三四",
  ]);
});

test("tabs expand to eight-space stops", () => {
  assert.deepEqual(wrapText("\thello", 200, measure), ["        hello"]);
  assert.deepEqual(wrapText("a\tb", 200, measure), ["a       b"]);
});

test("CR and CRLF count as line breaks", () => {
  assert.deepEqual(wrapText("one\r\ntwo\rthree", 200, measure), [
    "one",
    "two",
    "three",
  ]);
});
