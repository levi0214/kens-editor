import { useCallback, useEffect, useRef, useState } from "react";
import { KeyHints } from "./keyHint";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

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
        return;
      }

      if (confirmDeletePath || documents.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, documents.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDeletePath, documents, onClose, performDelete]);

  useEffect(() => {
    if (loading || documents.length === 0) {
      return;
    }

    const index = documents.findIndex((document) => document.path === currentPath);
    setActiveIndex(index >= 0 ? index : 0);
  }, [currentPath, documents, loading]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
      onSelect(filePath);
      onClose();
    },
    [onClose, onSelect],
  );

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || confirmDeletePath || documents.length === 0) {
      return;
    }

    event.preventDefault();
    const document = documents[activeIndex];
    if (document) {
      openDocument(document.path);
    }
  };

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
            <KeyHints keys={["↑", "↓", "↵"]} />
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
        <div
          className="picker-list"
          ref={listRef}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {loading ? (
            <div className="picker-empty">Loading…</div>
          ) : documents.length === 0 ? (
            <div className="picker-empty">No documents yet</div>
          ) : (
            documents.map((document, index) => {
              const selected = document.path === currentPath;
              const active = index === activeIndex;
              const confirming = document.path === confirmDeletePath;
              const preview =
                document.path === currentPath
                  ? previewFromText(currentText)
                  : document.preview;
              const empty = preview === "(empty)";

              return (
                <div
                  key={document.path}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  className={`picker-item${selected ? " picker-item-selected" : ""}${active ? " picker-item-active" : ""}${confirming ? " picker-item-confirm" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
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
