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
  step: number,
): string | null {
  if (documents.length === 0) {
    return null;
  }

  const nextIndex = documentIndex(documents, path) + step;
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

function arrowStep(key: string, columns: number): number | null {
  switch (key.toLowerCase()) {
    case "arrowleft":
      return -1;
    case "arrowright":
      return 1;
    case "arrowdown":
      return columns;
    case "arrowup":
      return -columns;
    default:
      return null;
  }
}

export function pickerMoveStep(event: KeyboardEvent, columns = 1): number {
  if (event.altKey || event.ctrlKey) {
    return 0;
  }

  return jkStep(event.key) ?? arrowStep(event.key, columns) ?? 0;
}

export function flipDirection(event: KeyboardEvent): 1 | -1 | null {
  if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) {
    return null;
  }

  return jkStep(event.key);
}
