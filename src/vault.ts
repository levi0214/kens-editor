import { invoke } from "@tauri-apps/api/core";

export interface VaultDocument {
  name: string;
  path: string;
  createdMs: number;
  preview: string;
  pinned: boolean;
}

// Count only. Contents are loaded when the picker opens.
let documentCount: number | null = null;

export function getVaultDocumentCount(): number | null {
  return documentCount;
}

export async function refreshVaultDocumentCount(): Promise<void> {
  try {
    documentCount = await invoke<number>("count_vault_documents");
  } catch {
    // Keep the last known size.
  }
}

export async function listVaultDocuments(): Promise<VaultDocument[]> {
  const documents = await invoke<VaultDocument[]>("list_vault_documents");
  documentCount = documents.length;
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
  if (documentCount !== null) documentCount += 1;
  return path;
}

export async function deleteVaultDocument(path: string): Promise<void> {
  await invoke("delete_vault_document", { path });
  if (documentCount !== null) documentCount = Math.max(0, documentCount - 1);
}

export async function toggleVaultDocumentPin(path: string): Promise<boolean> {
  return invoke<boolean>("toggle_vault_document_pin", { path });
}

export async function revealVaultInFinder(): Promise<void> {
  await invoke("reveal_vault_in_finder");
}
