# Version History Review

Date: 2026-08-07

The feature has the right shape: explicit snapshots, a simple numbered history,
and diffs against the previous version. It stays local and does not expose Git
concepts.

Before adding more capability, tighten resource use, state consistency, and
tests.

## P0: Stop hidden history work

**Status: Done** — committed in `73ce32d`.

`VersionHistory` remains mounted when its sidebar is closed. On mount it lists
versions, reads every snapshot, calculates every pairwise line count, and then
recalculates the Current diff as the user types. `App` also lists the versions
separately to obtain the count.

This means a closed feature can become more expensive as the document history
grows.

Change:

- Keep one owner for version metadata.
- Do not read snapshot bodies or calculate diffs until the sidebar opens.
- Keep the save-version shortcut independent from the visible sidebar.
- Cache calculated counts while the version list is unchanged.
- Remove the unused `preview` field from `DocumentVersion`; the backend still
  reads it for every version even though the UI no longer displays it.

Done when:

- Typing with Versions closed performs no version diff work.
- Opening a document does not read every saved snapshot.
- Opening Versions loads each required snapshot at most once.

Relevant code: `src/App.tsx`, `src/VersionHistory.tsx`, `src/versions.ts`, and
`src-tauri/src/lib.rs`.

## P0: Prevent stale diff frames

**Status: Done** — committed in `781878c`.

When the selected version changes, `VersionDiff` renders once with the new
version label and the previously loaded texts. Its effect clears those texts
after the render, so rapid selection can briefly show the wrong content beneath
the right heading.

Change:

- Associate loaded text with both version IDs.
- Render a loading state unless the loaded IDs match the current comparison.
- Preserve the full-document preference while switching versions.

Done when:

- A comparison is never rendered beneath labels for another comparison.
- Rapidly clicking several versions cannot expose stale content.

Relevant code: `src/VersionDiff.tsx`.

## P1: Disable redundant saves

**Status: Done** — committed in `f8dbfa4`.

The Save button is currently disabled only while loading or saving. The backend
already rejects a duplicate snapshot, and the client already has the latest
saved text.

Change:

- Disable Save when `latestSavedText !== null` and
  `currentText === latestSavedText`.
- Keep the backend equality check as the final guard.
- If the latest version cannot be read, leave Save available rather than
  incorrectly disabling it.

This adds no disk access. It is an in-memory string comparison.

Relevant code: `src/VersionHistory.tsx` and `src-tauri/src/lib.rs`.

## P1: Make loading and saving states reliable

Failures while reading snapshot bodies are currently swallowed, leaving the
line counts at `…` indefinitely. A save request from the keyboard can also run
while the sidebar's initial list is still loading, allowing the older list
response to overwrite the newly updated client state.

Change:

- Show an explicit history-loading error with a retry action.
- Do not silently leave permanent `…` values.
- Serialize initial loading and save requests, or move saving out of the
  sidebar component.
- Ensure repeated save shortcuts cannot lose the latest request while a save is
  already running.

Relevant code: `src/VersionHistory.tsx` and `src/App.tsx`.

## P1: Handle trailing-newline-only changes

**Status: Done** — trailing final newlines are normalized for diffs; committed
in `e7e5ed2`.

The current line splitter removes a final empty entry. Comparing `a` with
`a\n` therefore produces one removed and one added line whose visible contents
are identical, with no word-level highlight.

Choose one rule:

- Normalize trailing newlines at the snapshot boundary and treat the two texts
  as equivalent; or
- Preserve the distinction and show a clear non-text marker for the missing
  final newline.

For an editor aimed at prose, normalization is probably the simpler rule.

Relevant code: `src/documentDiff.ts`.

## P1: Add tests around stored versions and windows

**Status: Partly done.** Window expansion and contraction are covered in
`f5b2718` and `1cad7e2`. Version saving, duplicate detection, ordering,
numbering, filename collisions, and invalid IDs are covered in `9bc9e72`.
Non-vault documents, deletion cleanup, Chinese text, blank lines, and unequal
split blocks still need coverage.

The TypeScript diff model has six tests. The Rust test suite currently compiles
but contains no tests, and `planWindowExpansion` has no direct tests.

Add coverage for:

- Saving the first version.
- Refusing a duplicate version.
- Stable ordering and numbering.
- Rejecting invalid version IDs and non-vault documents.
- Removing the versions directory when a document is deleted.
- Same-millisecond version filename collisions.
- Window expansion with room on the right, room only on the left, partial room,
  no room, and non-zero monitor origins.
- Chinese word-level changes, blank lines, trailing newlines, and unequal split
  blocks.

Relevant code: `src-tauri/src/lib.rs`, `src/windowExpansion.ts`, and
`tests/documentDiff.test.mjs`.

## P2: Expand omitted content in place

Clicking `···` currently expands the full document and resets the scroll
position to the top. The interaction would feel more direct if the clicked
omission stayed near the same screen position after expansion.

Change:

- Capture the clicked separator as a visual anchor.
- Expand the full diff without animation.
- Restore the anchor's screen position after the new rows render.
- Returning to Changes only may reset to the first change.

Relevant code: `src/VersionDiff.tsx`.

## P2: Preserve user window adjustments

**Status: Done** — closing Versions now removes only the automatic adjustment
while preserving user movement and resizing; committed in `1cad7e2`.

Opening Versions stores the complete original window frame. Closing it restores
that frame exactly, which can discard window movement or resizing performed by
the user while the sidebar was open.

Change:

- Track the width added by the app.
- On close, remove only that automatic expansion where possible.
- Preserve deliberate movement and resizing, clamped to the current monitor.

Relevant code: `src/useVersionSidebarWindow.ts` and
`src/windowExpansion.ts`.

## Suggested order

1. Stop hidden history work and remove version previews.
2. Disable redundant saves and fix load/save sequencing.
3. Prevent stale diff frames.
4. Decide and test trailing-newline behavior.
5. Add Rust and window-expansion tests.
6. Preserve the `···` anchor and user window adjustments.

## Later, if needed

The only obvious next capability is Restore Vn as Current. It should copy the
old text into the current document, leaving all snapshots intact. It should not
introduce checkout, branches, merge, or detached states.

Do not add arbitrary version comparison, version deletion, automatic pruning,
or Git terminology until real use shows a need.

## Verification baseline

At the time of this review:

- `npm test`: 6 tests pass.
- `npm run build`: passes.
- `cargo test --manifest-path src-tauri/Cargo.toml`: compiles and passes with
  0 Rust tests.
