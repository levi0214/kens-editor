import { invoke } from "@tauri-apps/api/core";

export interface DocumentVersion {
  id: string;
  number: number;
  createdMs: number;
}

export interface DocumentVersionReader {
  read: (versionId: string) => Promise<string>;
  remember: (versionId: string, contents: string) => void;
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

export async function deleteDocumentVersion(
  documentPath: string,
  versionId: string,
): Promise<void> {
  await invoke("delete_document_version", {
    documentPath,
    versionId,
  });
}

export function createDocumentVersionReader(
  documentPath: string,
): DocumentVersionReader {
  const cache = new Map<string, Promise<string>>();

  return {
    read(versionId) {
      let contents = cache.get(versionId);
      if (!contents) {
        contents = readDocumentVersion(documentPath, versionId);
        cache.set(versionId, contents);
        void contents.catch(() => {
          if (cache.get(versionId) === contents) {
            cache.delete(versionId);
          }
        });
      }
      return contents;
    },
    remember(versionId, contents) {
      cache.set(versionId, Promise.resolve(contents));
    },
  };
}
