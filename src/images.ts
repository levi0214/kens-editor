import { invoke } from "@tauri-apps/api/core";

export interface DocumentImage {
  name: string;
  path: string;
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(path);
}

function imageFileExtension(file: File): string | null {
  const byType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return (
    byType[file.type] ??
    file.name.match(/\.(png|jpe?g|gif|webp)$/i)?.[1] ??
    null
  );
}

export function clipboardImageFiles(
  clipboardData: DataTransfer | null,
): File[] {
  return Array.from(clipboardData?.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(
      (file): file is File =>
        file !== null && imageFileExtension(file) !== null,
    );
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

export async function addDocumentImageFiles(
  documentPath: string,
  files: File[],
): Promise<DocumentImage[]> {
  let images: DocumentImage[] = [];
  const stamp = Date.now();

  for (const [index, file] of files.entries()) {
    const extension = imageFileExtension(file);
    if (!extension) {
      continue;
    }
    const fileName = isImagePath(file.name)
      ? file.name
      : `pasted-${stamp}-${index + 1}.${extension}`;
    const buffer = await file.arrayBuffer();
    images = await addDocumentImageBytes(
      documentPath,
      fileName,
      Array.from(new Uint8Array(buffer)),
    );
  }

  return images;
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
