import { invoke } from "@tauri-apps/api/core";

export interface VaultDocument {
  name: string;
  path: string;
  createdMs: number;
  preview: string;
  pinned: boolean;
}

// Only the count survives closing the picker. Contents are loaded on each open.
let documentCount: number | null = null;
let countRevision = 0;

export function getVaultDocumentCount(): number | null {
  return documentCount;
}

export async function refreshVaultDocumentCount(): Promise<void> {
  const revision = ++countRevision;
  // Until the refresh finishes, new pickers must not size themselves from stale data.
  documentCount = null;
  try {
    const count = await invoke<number>("count_vault_documents");
    if (revision === countRevision) documentCount = count;
  } catch {
    if (revision === countRevision) documentCount = null;
  }
}

export async function listVaultDocuments(): Promise<VaultDocument[]> {
  const revision = countRevision;
  const documents = await invoke<VaultDocument[]>("list_vault_documents");
  if (revision === countRevision) {
    countRevision += 1;
    documentCount = documents.length;
  }
  return documents;
}

export async function searchVaultDocuments(
  query: string,
  currentPath: string | null,
  currentText: string,
): Promise<VaultDocument[]> {
  return invoke<VaultDocument[]>("search_vault_documents", {
    query,
    currentPath,
    currentText,
  });
}

export async function mostRecentVaultDocument(): Promise<string | null> {
  return invoke<string | null>("most_recent_vault_document");
}

export async function peekMostRecentVaultDocument(): Promise<string | null> {
  return invoke<string | null>("peek_most_recent_vault_document");
}

export async function createVaultDocument(): Promise<string> {
  const path = await invoke<string>("create_vault_document");
  await refreshVaultDocumentCount();
  return path;
}

export async function deleteVaultDocument(path: string): Promise<void> {
  await invoke("delete_vault_document", { path });
  await refreshVaultDocumentCount();
}

export async function toggleVaultDocumentPin(path: string): Promise<boolean> {
  return invoke<boolean>("toggle_vault_document_pin", { path });
}

export async function revealVaultInFinder(): Promise<void> {
  await invoke("reveal_vault_in_finder");
}
