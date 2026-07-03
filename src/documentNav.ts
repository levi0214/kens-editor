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

function keyStep(key: string): -1 | 0 | 1 {
  switch (key.toLowerCase()) {
    case "j":
    case "arrowdown":
      return 1;
    case "k":
    case "arrowup":
      return -1;
    default:
      return 0;
  }
}

export function pickerMoveStep(event: KeyboardEvent): -1 | 0 | 1 {
  if (event.altKey || event.ctrlKey) {
    return 0;
  }

  return keyStep(event.key);
}

export function flipDirection(event: KeyboardEvent): 1 | -1 | null {
  if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) {
    return null;
  }

  const step = keyStep(event.key);
  return step === 0 ? null : step;
}
