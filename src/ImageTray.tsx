import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDocumentImageFiles,
  addDocumentImages,
  clipboardImageFiles,
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function navigationStep(key: string): -1 | 1 | 0 {
  switch (key.toLowerCase()) {
    case "arrowleft":
    case "k":
      return -1;
    case "arrowright":
    case "j":
      return 1;
    default:
      return 0;
  }
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const addingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const selectedIndex = selectedPath
    ? images.findIndex((image) => image.path === selectedPath)
    : -1;
  const selectedImage = selectedIndex >= 0 ? images[selectedIndex] : null;

  const replaceImages = useCallback(
    (next: DocumentImage[]) => {
      setImages(next);
      setSelectedPath((current) =>
        current && next.some((image) => image.path === current)
          ? current
          : next[0]?.path ?? null,
      );
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
      await runImport(() => addDocumentImageFiles(documentPath, files));
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
      const files = clipboardImageFiles(event.clipboardData);
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
        const removedIndex = images.findIndex(
          (image) => image.path === imagePath,
        );
        const next = images.filter((image) => image.path !== imagePath);
        replaceImages(next);
        if (selectedPath === imagePath) {
          setSelectedPath(
            next[Math.min(removedIndex, next.length - 1)]?.path ?? null,
          );
        }
        requestAnimationFrame(() => selectedItemRef.current?.focus());
      } catch (deleteError) {
        setError(errorText(deleteError));
      }
    },
    [documentPath, images, replaceImages, selectedPath],
  );

  const moveSelection = useCallback(
    (step: -1 | 1) => {
      if (images.length === 0) {
        return;
      }

      setSelectedPath((current) => {
        const index = Math.max(
          0,
          images.findIndex((image) => image.path === current),
        );
        const nextIndex = index + step;
        return nextIndex >= 0 && nextIndex < images.length
          ? images[nextIndex].path
          : current ?? images[0].path;
      });
    },
    [images],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (previewOpen) {
        previewRef.current?.focus();
        return;
      }

      const target = selectedItemRef.current ?? gridRef.current;
      target?.focus();
      selectedItemRef.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, previewOpen, selectedPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (previewOpen) {
          setPreviewOpen(false);
        } else {
          onClose();
        }
        return;
      }

      const plainKey =
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.shiftKey;
      const step = plainKey ? navigationStep(event.key) : 0;

      if (previewOpen) {
        if (plainKey && event.key === " ") {
          event.preventDefault();
          setPreviewOpen(false);
        } else if (step !== 0) {
          event.preventDefault();
          moveSelection(step);
        }
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          ".image-tray-action, .image-tray-delete, .image-tray-empty button",
        )
      ) {
        return;
      }

      if (
        event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        event.key === "Backspace" &&
        selectedImage
      ) {
        event.preventDefault();
        void removeImage(selectedImage.path);
      } else if (step !== 0) {
        event.preventDefault();
        moveSelection(step);
      } else if (plainKey && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        if (selectedImage) {
          setPreviewOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelection, onClose, previewOpen, removeImage, selectedImage]);

  useEffect(() => {
    if (previewOpen && !selectedImage) {
      setPreviewOpen(false);
    }
  }, [previewOpen, selectedImage]);

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
          ref={gridRef}
          className={`image-tray-grid${dragging ? " image-tray-grid-dragging" : ""}`}
          tabIndex={images.length === 0 ? 0 : -1}
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
            images.map((image, index) => {
              const selected = image.path === selectedPath;
              const label = `Image ${index + 1}`;
              return (
                <article
                  key={image.path}
                  className={`image-tray-item${selected ? " image-tray-item-selected" : ""}`}
                >
                  <button
                    ref={selected ? selectedItemRef : undefined}
                    type="button"
                    className="image-tray-open"
                    aria-label={`Open ${label.toLowerCase()}`}
                    aria-current={selected ? "true" : undefined}
                    tabIndex={selected ? 0 : -1}
                    onFocus={() => setSelectedPath(image.path)}
                    onClick={() => {
                      setSelectedPath(image.path);
                      setPreviewOpen(true);
                    }}
                  >
                    <img
                      src={convertFileSrc(image.path)}
                      alt=""
                    />
                  </button>
                  <button
                    type="button"
                    className="image-tray-delete"
                    title="Remove"
                    aria-label={`Remove ${label.toLowerCase()}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => void removeImage(image.path)}
                  >
                    <TrashIcon />
                  </button>
                </article>
              );
            })
          )}
        </div>

        {error && <div className="image-tray-error">{error}</div>}
      </div>
      {previewOpen && selectedImage && (
        <div
          ref={previewRef}
          className="image-tray-preview"
          role="dialog"
          aria-label={`Image preview, ${selectedIndex + 1} of ${images.length}`}
          tabIndex={-1}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => setPreviewOpen(false)}
        >
          <img
            src={convertFileSrc(selectedImage.path)}
            alt=""
          />
          <span className="image-tray-preview-count">
            {selectedIndex + 1} / {images.length}
          </span>
        </div>
      )}
    </div>
  );
}
