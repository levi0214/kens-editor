import { useCallback, useEffect, useRef, useState } from "react";
import { previewFromText } from "./preview";
import { CheckIcon, CloseIcon, FinderIcon, TrashIcon } from "./statusBarIcons";
import { relativeTime } from "./relativeTime";
import {
  deleteVaultDocument,
  listVaultDocuments,
  revealVaultInFinder,
  type VaultDocument,
} from "./vault";

interface DocumentPickerProps {
  currentPath: string | null;
  currentText: string;
  onClose: () => void;
  onDelete: (path: string) => void;
  onSelect: (path: string) => void;
}

export function DocumentPicker({
  currentPath,
  currentText,
  onClose,
  onDelete,
  onSelect,
}: DocumentPickerProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDeletePath, onClose, performDelete]);

  useEffect(() => {
    listRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (confirmDeletePath) {
      confirmDeleteRef.current?.focus();
    }
  }, [confirmDeletePath]);

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
                  className={`picker-item${selected ? " picker-item-selected" : ""}${confirming ? " picker-item-confirm" : ""}`}
                >
                  <button
                    type="button"
                    className="picker-item-open"
                    onClick={() => {
                      if (confirming) {
                        return;
                      }
                      onSelect(document.path);
                      onClose();
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
                        {relativeTime(document.modifiedMs)}
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
                      <button
                        type="button"
                        className="picker-item-delete"
                        title="Delete"
                        aria-label="Delete document"
                        onClick={() => setConfirmDeletePath(document.path)}
                      >
                        <TrashIcon className="picker-item-icon" />
                      </button>
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
