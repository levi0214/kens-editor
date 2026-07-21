import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDocumentImageBytes,
  addDocumentImages,
  deleteDocumentImage,
  isImagePath,
  listDocumentImages,
  revealDocumentImages,
  type DocumentImage,
} from "./images";
import { FinderIcon, PlusIcon, TrashIcon } from "./statusBarIcons";

interface ImageTrayProps {
  documentPath: string;
  onClose: () => void;
  onCountChange: (count: number) => void;
}

function displayName(name: string): string {
  return name.replace(/^\d+_/, "");
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clipboardExtension(file: File): string | null {
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

export function ImageTray({
  documentPath,
  onClose,
  onCountChange,
}: ImageTrayProps) {
  const [images, setImages] = useState<DocumentImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<DocumentImage | null>(null);
  const addingRef = useRef(false);

  const replaceImages = useCallback(
    (next: DocumentImage[]) => {
      setImages(next);
      onCountChange(next.length);
    },
    [onCountChange],
  );

  const runImport = useCallback(
    async (operation: () => Promise<DocumentImage[]>) => {
      if (addingRef.current) {
        return;
      }

      addingRef.current = true;
      setAdding(true);
      setError(null);
      try {
        replaceImages(await operation());
      } catch (importError) {
        setError(errorText(importError));
      } finally {
        addingRef.current = false;
        setAdding(false);
      }
    },
    [replaceImages],
  );

  useEffect(() => {
    let active = true;
    void listDocumentImages(documentPath)
      .then((next) => {
        if (active) {
          replaceImages(next);
          setLoading(false);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(errorText(loadError));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [documentPath, replaceImages]);

  const importPaths = useCallback(
    async (paths: string[]) => {
      const imagePaths = paths.filter(isImagePath);
      if (imagePaths.length === 0) {
        setError("Drop PNG, JPEG, GIF, or WebP images");
        return;
      }
      await runImport(() => addDocumentImages(documentPath, imagePaths));
    },
    [documentPath, runImport],
  );

  const addImages = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp"],
        },
      ],
    });
    if (selected === null) {
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];
    await importPaths(paths);
  }, [importPaths]);

  const pasteImages = useCallback(
    async (files: File[]) => {
      await runImport(async () => {
        let next: DocumentImage[] = [];
        for (const [index, file] of files.entries()) {
          const extension = clipboardExtension(file);
          if (!extension) {
            continue;
          }
          const fileName = isImagePath(file.name)
            ? file.name
            : `pasted-${Date.now()}-${index + 1}.${extension}`;
          const buffer = await file.arrayBuffer();
          next = await addDocumentImageBytes(
            documentPath,
            fileName,
            Array.from(new Uint8Array(buffer)),
          );
        }
        return next;
      });
    },
    [documentPath, runImport],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter") {
          setDragging(event.payload.paths.some(isImagePath));
        } else if (event.payload.type === "leave") {
          setDragging(false);
        } else if (event.payload.type === "drop") {
          setDragging(false);
          void importPaths(event.payload.paths);
        }
      })
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [importPaths]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(
          (file): file is File =>
            file !== null && clipboardExtension(file) !== null,
        );
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      void pasteImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteImages]);

  const removeImage = useCallback(
    async (imagePath: string) => {
      setError(null);
      try {
        await deleteDocumentImage(documentPath, imagePath);
        replaceImages(images.filter((image) => image.path !== imagePath));
        setPreviewImage((image) => (image?.path === imagePath ? null : image));
      } catch (deleteError) {
        setError(errorText(deleteError));
      }
    },
    [documentPath, images, replaceImages],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (previewImage) {
        setPreviewImage(null);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, previewImage]);

  return (
    <div className="image-tray-backdrop" onMouseDown={onClose}>
      <div
        className="image-tray-panel"
        role="dialog"
        aria-label="Images"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="image-tray-header">
          <span className="image-tray-title">
            Images{images.length > 0 ? ` ${images.length}` : ""}
          </span>
          <span className="image-tray-actions">
            <button
              type="button"
              className="image-tray-action"
              title="View in Finder"
              aria-label="View images in Finder"
              onClick={() => {
                void revealDocumentImages(documentPath);
              }}
            >
              <FinderIcon className="image-tray-action-icon" />
              Finder
            </button>
            <button
              type="button"
              className="image-tray-action image-tray-add"
              disabled={adding}
              onClick={() => void addImages()}
            >
              <PlusIcon className="image-tray-action-icon" />
              {adding ? "Adding…" : "Add"}
            </button>
          </span>
        </header>

        <div
          className={`image-tray-grid${dragging ? " image-tray-grid-dragging" : ""}`}
        >
          {loading ? (
            <div className="image-tray-empty">Loading…</div>
          ) : images.length === 0 ? (
            <div className="image-tray-empty">
              <span>Drop or paste images here</span>
              <button type="button" onClick={() => void addImages()}>
                Add images
              </button>
            </div>
          ) : (
            images.map((image) => (
              <article key={image.path} className="image-tray-item">
                <button
                  type="button"
                  className="image-tray-open"
                  title={displayName(image.name)}
                  onClick={() => setPreviewImage(image)}
                >
                  <img
                    src={convertFileSrc(image.path)}
                    alt={displayName(image.name)}
                  />
                </button>
                <footer className="image-tray-item-footer">
                  <span className="image-tray-name">
                    {displayName(image.name)}
                  </span>
                  <button
                    type="button"
                    className="image-tray-delete"
                    title="Remove"
                    aria-label={`Remove ${displayName(image.name)}`}
                    onClick={() => void removeImage(image.path)}
                  >
                    <TrashIcon />
                  </button>
                </footer>
              </article>
            ))
          )}
        </div>

        {error && <div className="image-tray-error">{error}</div>}
      </div>
      {previewImage && (
        <button
          type="button"
          className="image-tray-preview"
          aria-label="Close image preview"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={convertFileSrc(previewImage.path)}
            alt={displayName(previewImage.name)}
          />
        </button>
      )}
    </div>
  );
}
