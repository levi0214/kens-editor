import { useEffect, useRef, useState } from "react";
import { previewFromText } from "./preview";
import { FinderIcon } from "./statusBarIcons";
import { relativeTime } from "./relativeTime";
import { listVaultDocuments, revealVaultInFinder, type VaultDocument } from "./vault";

interface DocumentPickerProps {
  currentPath: string | null;
  currentText: string;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function DocumentPicker({
  currentPath,
  currentText,
  onClose,
  onSelect,
}: DocumentPickerProps) {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    listRef.current?.focus();
  }, [loading]);

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
              const preview =
                document.path === currentPath
                  ? previewFromText(currentText)
                  : document.preview;
              const empty = preview === "(empty)";

              return (
                <button
                  key={document.path}
                  type="button"
                  className={`picker-item${selected ? " picker-item-selected" : ""}`}
                  onClick={() => {
                    onSelect(document.path);
                    onClose();
                  }}
                >
                  <span
                    className={`picker-item-preview${empty ? " picker-item-preview-empty" : ""}`}
                  >
                    {preview}
                  </span>
                  <span className="picker-item-time">
                    {relativeTime(document.modifiedMs)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
