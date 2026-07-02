import { invoke } from "@tauri-apps/api/core";

export interface VaultDocument {
  name: string;
  path: string;
  modifiedMs: number;
}

export async function listVaultDocuments(): Promise<VaultDocument[]> {
  return invoke<VaultDocument[]>("list_vault_documents");
}

export async function mostRecentVaultDocument(): Promise<string | null> {
  return invoke<string | null>("most_recent_vault_document");
}

export async function createVaultDocument(): Promise<string> {
  return invoke<string>("create_vault_document");
}

export async function revealVaultInFinder(): Promise<void> {
  await invoke("reveal_vault_in_finder");
}
