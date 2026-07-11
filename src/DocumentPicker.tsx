import { useCallback, useEffect, useRef, useState } from "react";
import { adjacentDocumentPath, pickerMoveStep } from "./documentNav";
import { KeyHints } from "./keyHint";
import { previewFromText } from "./preview";
import { CheckIcon, CloseIcon, FinderIcon, PinFilledIcon, PinIcon, TrashIcon } from "./statusBarIcons";
import { shortDate } from "./shortDate";
import {
  deleteVaultDocument,
  listVaultDocuments,
  revealVaultInFinder,
  toggleVaultDocumentPin,
  type VaultDocument,
} from "./vault";

interface DocumentPickerProps {
  currentPath: string | null;
  currentText: string;
  onClose: () => void;
  onDelete: (path: string) => void;
  onSwitch: (path: string) => void;
}

export function DocumentPicker({
  currentPath,
  currentText,
  onClose,
  onDelete,
  onSwitch,
}: DocumentPickerProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;

    void listVaultDocuments()
      .then((items) => {
        if (active) {
          setDocuments(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const performDelete = useCallback(
    async (targetPath: string) => {
      await deleteVaultDocument(targetPath);
      setDocuments((current) => current.filter((document) => document.path !== targetPath));
      setConfirmDeletePath(null);
      onDelete(targetPath);
    },
    [onDelete],
  );

  const togglePin = useCallback(async (targetPath: string) => {
    await toggleVaultDocumentPin(targetPath);
    const items = await listVaultDocuments();
    setDocuments(items);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && confirmDeletePath) {
        event.preventDefault();
        void performDelete(confirmDeletePath);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmDeletePath) {
          setConfirmDeletePath(null);
        } else {
          onClose();
        }
        return;
      }

      if (confirmDeletePath || documents.length === 0) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onClose();
        return;
      }

      if (
        event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        event.key === "Backspace" &&
        currentPath
      ) {
        event.preventDefault();
        setConfirmDeletePath(currentPath);
        return;
      }

      const step = pickerMoveStep(event);
      if (step === 0) {
        return;
      }

      event.preventDefault();
      const nextPath = adjacentDocumentPath(documents, currentPath, step);
      if (nextPath) {
        onSwitch(nextPath);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDeletePath, currentPath, documents, onClose, onSwitch, performDelete]);

  useEffect(() => {
    if (loading || documents.length === 0) {
      return;
    }

    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentPath, documents, loading]);

  useEffect(() => {
    listRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (confirmDeletePath) {
      confirmDeleteRef.current?.focus();
    }
  }, [confirmDeletePath]);

  const openDocument = useCallback(
    (filePath: string) => {
      onSwitch(filePath);
      onClose();
    },
    [onClose, onSwitch],
  );

  return (
    <div className="picker-backdrop" onMouseDown={onClose}>
      <div
        className="picker-panel"
        role="dialog"
        aria-label="Documents"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="picker-header">
          <span className="picker-title">Documents</span>
          <span className="picker-hint">
            <KeyHints keys={["↑", "↓", "⌘", "⌫", "↵", "Esc"]} />
          </span>
          <button
            type="button"
            className="picker-finder"
            title="View in Finder"
            aria-label="View in Finder"
            onClick={() => {
              void revealVaultInFinder();
            }}
          >
            <FinderIcon className="picker-finder-icon" />
            <span className="picker-finder-label">Finder</span>
          </button>
        </div>
        <div className="picker-list" ref={listRef} tabIndex={-1}>
          {loading ? (
            <div className="picker-empty">Loading…</div>
          ) : documents.length === 0 ? (
            <div className="picker-empty">No documents yet</div>
          ) : (
            documents.map((document) => {
              const selected = document.path === currentPath;
              const confirming = document.path === confirmDeletePath;
              const preview =
                document.path === currentPath
                  ? previewFromText(currentText)
                  : document.preview;
              const empty = preview === "(empty)";

              return (
                <div
                  key={document.path}
                  ref={selected ? selectedItemRef : undefined}
                  className={`picker-item${selected ? " picker-item-selected" : ""}${confirming ? " picker-item-confirm" : ""}`}
                >
                  <button
                    type="button"
                    className="picker-item-open"
                    onClick={() => {
                      if (confirming) {
                        return;
                      }
                      openDocument(document.path);
                    }}
                  >
                    <span
                      className={`picker-item-preview${empty ? " picker-item-preview-empty" : ""}`}
                    >
                      {preview}
                    </span>
                  </button>
                  <div className="picker-item-meta">
                    {!confirming && (
                      <span className="picker-item-time">
                        {shortDate(document.createdMs)}
                      </span>
                    )}
                    {confirming ? (
                      <>
                        <button
                          type="button"
                          className="picker-item-cancel"
                          title="Cancel"
                          aria-label="Cancel"
                          onClick={() => setConfirmDeletePath(null)}
                        >
                          <CloseIcon className="picker-item-icon" />
                        </button>
                        <button
                          ref={confirmDeleteRef}
                          type="button"
                          className="picker-item-confirm-delete"
                          title="Delete"
                          aria-label="Delete document"
                          onClick={() => {
                            void performDelete(document.path);
                          }}
                        >
                          <CheckIcon className="picker-item-icon" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`picker-item-pin${document.pinned ? " picker-item-pin-active" : ""}`}
                          title={document.pinned ? "Unpin" : "Pin"}
                          aria-label={document.pinned ? "Unpin document" : "Pin document"}
                          aria-pressed={document.pinned}
                          onClick={() => {
                            void togglePin(document.path);
                          }}
                        >
                          {document.pinned ? (
                            <PinFilledIcon className="picker-item-icon" />
                          ) : (
                            <PinIcon className="picker-item-icon" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="picker-item-delete"
                          title="Delete"
                          aria-label="Delete document"
                          onClick={() => setConfirmDeletePath(document.path)}
                        >
                          <TrashIcon className="picker-item-icon" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
