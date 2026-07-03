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

function vimKey(event: KeyboardEvent): string | null {
  if (event.altKey || event.ctrlKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  return key === "j" || key === "k" ? key : null;
}

export function pickerMoveStep(event: KeyboardEvent): -1 | 0 | 1 {
  if (event.key === "ArrowDown") {
    return 1;
  }
  if (event.key === "ArrowUp") {
    return -1;
  }

  const key = vimKey(event);
  if (key === "j") {
    return 1;
  }
  if (key === "k") {
    return -1;
  }

  return 0;
}

export function flipDirection(event: KeyboardEvent): 1 | -1 | null {
  if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "j") {
    return 1;
  }
  if (key === "k") {
    return -1;
  }

  return null;
}
