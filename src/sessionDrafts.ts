import { createVaultDocument, deleteVaultDocument } from "./vault";

const pristineDrafts = new Set<string>();

export function registerPristineDraft(path: string): void {
  pristineDrafts.add(path);
}

export function forgetDraft(path: string): void {
  pristineDrafts.delete(path);
}

export function isPristineDraft(path: string): boolean {
  return pristineDrafts.has(path);
}

export async function createPristineDraft(): Promise<string> {
  const path = await createVaultDocument();
  registerPristineDraft(path);
  return path;
}

export async function discardPristineDraft(
  path: string | null,
  text: string,
): Promise<void> {
  if (!path || text.length > 0 || !isPristineDraft(path)) {
    return;
  }

  await deleteVaultDocument(path);
  forgetDraft(path);
}
