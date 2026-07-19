import { useCallback, useEffect, useRef, useState } from "react";
import { adjacentDocumentPath, pickerMoveStep } from "./documentNav";
import { KeyHints } from "./keyHint";
import { previewFromText } from "./preview";
import {
  CheckIcon,
  CloseIcon,
  FinderIcon,
  PinFilledIcon,
  PinIcon,
  TrashIcon,
} from "./statusBarIcons";
import { shortDate } from "./shortDate";
import {
  deleteVaultDocument,
  listVaultDocuments,
  revealVaultInFinder,
  searchVaultDocuments,
  toggleVaultDocumentPin,
  type VaultDocument,
} from "./vault";

interface DocumentPickerProps {
  currentPath: string | null;
  /** Immediate highlight while a load is in flight. */
  listPath?: string | null;
  currentText: string;
  onClose: () => void;
  onDelete: (path: string) => void;
  onSwitch: (path: string) => void;
}

function pickerColumnCount(list: HTMLDivElement | null): number {
  if (!list) {
    return 1;
  }

  return Number.parseInt(getComputedStyle(list).getPropertyValue("--picker-columns"), 10) || 1;
}

export function DocumentPicker({
  currentPath,
  listPath = null,
  currentText,
  onClose,
  onDelete,
  onSwitch,
}: DocumentPickerProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [resultsQuery, setResultsQuery] = useState("");
  const [searchPath, setSearchPath] = useState<string | null>(null);
  const [reloadSequence, setReloadSequence] = useState(0);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const searchActive = query.length > 0;
  const searchReady = !searchActive || resultsQuery === query;
  const searchSelection =
    searchReady && searchPath && documents.some((document) => document.path === searchPath)
      ? searchPath
      : searchReady
        ? documents[0]?.path ?? null
        : null;
  const highlightPath = searchActive ? searchSelection : listPath ?? currentPath;

  useEffect(() => {
    let active = true;
    const requestQuery = query;
    const timer = window.setTimeout(
      () => {
        const request = requestQuery
          ? searchVaultDocuments(requestQuery, currentPath, currentText)
          : listVaultDocuments();

        void request
          .then((items) => {
            if (active) {
              setDocuments(items);
              setResultsQuery(requestQuery);
              setLoading(false);
            }
          })
          .catch(() => {
            if (active) {
              setDocuments([]);
              setResultsQuery(requestQuery);
              setLoading(false);
            }
          });
      },
      requestQuery ? 50 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, reloadSequence]);

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
    setReloadSequence((current) => current + 1);
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) {
        return;
      }

      if (event.key === "Enter" && confirmDeletePath) {
        event.preventDefault();
        void performDelete(confirmDeletePath);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (confirmDeletePath) {
          setConfirmDeletePath(null);
        } else if (searchActive) {
          setQuery("");
          setSearchPath(null);
        } else {
          onClose();
        }
        return;
      }

      if (
        event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        event.key === "Backspace" &&
        searchActive
      ) {
        event.preventDefault();
        setQuery("");
        setSearchPath(null);
        return;
      }

      if (confirmDeletePath || documents.length === 0) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (searchActive) {
          if (searchReady && highlightPath) {
            onSwitch(highlightPath);
            onClose();
          }
        } else {
          onClose();
        }
        return;
      }

      if (
        event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        event.key === "Backspace" &&
        highlightPath
      ) {
        event.preventDefault();
        setConfirmDeletePath(highlightPath);
        return;
      }

      const fromSearchInput = event.target === searchInputRef.current;

      if (fromSearchInput && (event.metaKey || event.altKey || event.ctrlKey)) {
        return;
      }

      if (
        fromSearchInput &&
        (event.key.toLowerCase() === "j" || event.key.toLowerCase() === "k")
      ) {
        return;
      }

      if (
        searchActive &&
        fromSearchInput &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        return;
      }

      if (!searchReady) {
        return;
      }

      const columns = searchActive ? 1 : pickerColumnCount(listRef.current);
      const step = pickerMoveStep(event, columns);
      if (step === 0) {
        return;
      }

      event.preventDefault();
      const nextPath = adjacentDocumentPath(documents, highlightPath, step);
      if (nextPath) {
        if (searchActive) {
          setSearchPath(nextPath);
        } else {
          onSwitch(nextPath);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    confirmDeletePath,
    documents,
    highlightPath,
    onClose,
    onSwitch,
    performDelete,
    searchActive,
    searchReady,
  ]);

  useEffect(() => {
    if (loading || documents.length === 0) {
      return;
    }

    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [highlightPath, documents, loading]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirmDeletePath) {
      confirmDeleteRef.current?.focus();
    } else {
      searchInputRef.current?.focus();
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
        className={`picker-panel${searchActive ? " picker-panel-searching" : ""}`}
        role="dialog"
        aria-label="Documents"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="picker-header">
          <input
            ref={searchInputRef}
            className="picker-search"
            type="text"
            value={query}
            placeholder="Documents"
            aria-label="Search documents"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setSearchPath(null);
            }}
          />
          <span className="picker-hint">
            <KeyHints keys={["←", "↑", "↓", "→", "⌘", "⌫", "↵", "Esc"]} />
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
            <div className="picker-empty">
              {searchActive ? "No documents found" : "No documents yet"}
            </div>
          ) : (
            documents.map((document) => {
              const selected = document.path === highlightPath;
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
                      <div className="picker-item-actions">
                        <button
                          type="button"
                          className="picker-item-delete"
                          title="Delete"
                          aria-label="Delete document"
                          onClick={() => setConfirmDeletePath(document.path)}
                        >
                          <TrashIcon className="picker-item-icon" />
                        </button>
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
                      </div>
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
