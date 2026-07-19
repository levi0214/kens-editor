import { invoke } from "@tauri-apps/api/core";

export interface VaultDocument {
  name: string;
  path: string;
  createdMs: number;
  preview: string;
  pinned: boolean;
}

export async function listVaultDocuments(): Promise<VaultDocument[]> {
  return invoke<VaultDocument[]>("list_vault_documents");
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
  return invoke<string>("create_vault_document");
}

export async function deleteVaultDocument(path: string): Promise<void> {
  await invoke("delete_vault_document", { path });
}

export async function toggleVaultDocumentPin(path: string): Promise<boolean> {
  return invoke<boolean>("toggle_vault_document_pin", { path });
}

export async function revealVaultInFinder(): Promise<void> {
  await invoke("reveal_vault_in_finder");
}
