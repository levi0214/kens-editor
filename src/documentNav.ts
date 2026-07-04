import type { VaultDocument } from "./vault";

export function documentIndex(
  documents: VaultDocument[],
  path: string | null,
): number {
  if (!path) {
    return 0;
  }

  const index = documents.findIndex((doc) => doc.path === path);
  return index >= 0 ? index : 0;
}

export function adjacentDocumentPath(
  documents: VaultDocument[],
  path: string | null,
  direction: 1 | -1,
): string | null {
  if (documents.length === 0) {
    return null;
  }

  const nextIndex = documentIndex(documents, path) + direction;
  if (nextIndex < 0 || nextIndex >= documents.length) {
    return null;
  }

  return documents[nextIndex].path;
}

function jkStep(key: string): 1 | -1 | null {
  switch (key.toLowerCase()) {
    case "j":
      return 1;
    case "k":
      return -1;
    default:
      return null;
  }
}

function arrowStep(key: string): 1 | -1 | null {
  switch (key.toLowerCase()) {
    case "arrowdown":
      return 1;
    case "arrowup":
      return -1;
    default:
      return null;
  }
}

export function pickerMoveStep(event: KeyboardEvent): -1 | 0 | 1 {
  if (event.altKey || event.ctrlKey) {
    return 0;
  }

  return jkStep(event.key) ?? arrowStep(event.key) ?? 0;
}

export function flipDirection(event: KeyboardEvent): 1 | -1 | null {
  if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) {
    return null;
  }

  return jkStep(event.key);
}
