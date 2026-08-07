import { invoke } from "@tauri-apps/api/core";

export interface DocumentVersion {
  id: string;
  number: number;
  createdMs: number;
  preview: string;
}

export interface SaveVersionResult {
  created: boolean;
  version: DocumentVersion;
}

export async function listDocumentVersions(
  documentPath: string,
): Promise<DocumentVersion[]> {
  return invoke<DocumentVersion[]>("list_document_versions", {
    documentPath,
  });
}

export async function saveDocumentVersion(
  documentPath: string,
  contents: string,
): Promise<SaveVersionResult> {
  return invoke<SaveVersionResult>("save_document_version", {
    documentPath,
    contents,
  });
}

export async function readDocumentVersion(
  documentPath: string,
  versionId: string,
): Promise<string> {
  return invoke<string>("read_document_version", {
    documentPath,
    versionId,
  });
}
