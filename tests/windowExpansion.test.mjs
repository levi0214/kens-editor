import assert from "node:assert/strict";
import test from "node:test";
import { planWindowExpansion } from "../src/windowExpansion.ts";

const workArea = { x: 0, y: 0, width: 1440, height: 900 };

test("window expands to the right when there is room", () => {
  assert.deepEqual(
    planWindowExpansion(
      { x: 100, y: 80, width: 800, height: 700 },
      workArea,
      292,
    ),
    { addedWidth: 292, x: 100 },
  );
});

test("window shifts left when expansion does not fit on the right", () => {
  assert.deepEqual(
    planWindowExpansion(
      { x: 500, y: 80, width: 800, height: 700 },
      workArea,
      292,
    ),
    { addedWidth: 292, x: 348 },
  );
});

test("window uses only the width available on a narrow work area", () => {
  assert.deepEqual(
    planWindowExpansion(
      { x: 60, y: 40, width: 900, height: 700 },
      { x: 0, y: 0, width: 1000, height: 800 },
      292,
    ),
    { addedWidth: 100, x: 0 },
  );
});

test("window does not expand when the work area has no spare width", () => {
  assert.deepEqual(
    planWindowExpansion(
      { x: 0, y: 40, width: 1000, height: 700 },
      { x: 0, y: 0, width: 1000, height: 800 },
      292,
    ),
    { addedWidth: 0, x: 0 },
  );
});

test("window expansion respects a non-zero monitor origin", () => {
  assert.deepEqual(
    planWindowExpansion(
      { x: 2500, y: 80, width: 1000, height: 700 },
      { x: 1440, y: 0, width: 1920, height: 1080 },
      292,
    ),
    { addedWidth: 292, x: 2068 },
  );
});
