import { invoke } from "@tauri-apps/api/core";

export interface DocumentImage {
  name: string;
  path: string;
}

export function listDocumentImages(
  documentPath: string,
): Promise<DocumentImage[]> {
  return invoke<DocumentImage[]>("list_document_images", { documentPath });
}

export function addDocumentImages(
  documentPath: string,
  sourcePaths: string[],
): Promise<DocumentImage[]> {
  return invoke<DocumentImage[]>("add_document_images", {
    documentPath,
    sourcePaths,
  });
}

export function addDocumentImageBytes(
  documentPath: string,
  fileName: string,
  bytes: number[],
): Promise<DocumentImage[]> {
  return invoke<DocumentImage[]>("add_document_image_bytes", {
    documentPath,
    fileName,
    bytes,
  });
}

export async function deleteDocumentImage(
  documentPath: string,
  imagePath: string,
): Promise<void> {
  await invoke("delete_document_image", { documentPath, imagePath });
}

export async function revealDocumentImages(documentPath: string): Promise<void> {
  await invoke("reveal_document_images", { documentPath });
}
