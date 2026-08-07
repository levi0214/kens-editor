import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countChangedLines,
  type DocumentLineChanges,
} from "./documentDiff";
import { CloseIcon } from "./statusBarIcons";
import {
  type DocumentVersion,
  type SaveVersionResult,
} from "./versions";

interface VersionHistoryProps {
  open: boolean;
  documentPath: string;
  currentText: string;
  versions: DocumentVersion[];
  saving: boolean;
  saveError: string | null;
  readVersion: (versionId: string) => Promise<string>;
  onSave: () => Promise<SaveVersionResult | null>;
  selectedVersionId: string | null;
  onClose: () => void;
  onSelectCurrent: () => void;
  onSelectVersion: (
    version: DocumentVersion,
    previousVersion: DocumentVersion | null,
  ) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function versionTime(createdMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdMs));
}

export function VersionHistory({
  open,
  documentPath,
  currentText,
  versions,
  saving,
  saveError,
  readVersion,
  onSave,
  selectedVersionId,
  onClose,
  onSelectCurrent,
  onSelectVersion,
}: VersionHistoryProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    documentPath: string;
    versionKey: string;
    lineChanges: Record<string, DocumentLineChanges>;
    latestSavedText: string;
  } | null>(null);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const versionKey = useMemo(
    () => versions.map((version) => version.id).join("\n"),
    [versions],
  );
  const countsAreCurrent =
    counts?.documentPath === documentPath && counts.versionKey === versionKey;

  useEffect(() => {
    if (!open || countsAreCurrent) {
      return;
    }

    let active = true;
    setReadError(null);
    const chronological = [...versions].reverse();

    void Promise.all(chronological.map((version) => readVersion(version.id)))
      .then((contents) => {
        if (!active) {
          return;
        }

        let previous = "";
        const lineChanges: Record<string, DocumentLineChanges> = {};
        chronological.forEach((version, index) => {
          lineChanges[version.id] = countChangedLines(previous, contents[index]);
          previous = contents[index];
        });
        setCounts({
          documentPath,
          versionKey,
          lineChanges,
          latestSavedText: previous,
        });
      })
      .catch((loadError) => {
        if (active) {
          setReadError(errorText(loadError));
        }
      });

    return () => {
      active = false;
    };
  }, [countsAreCurrent, documentPath, open, readVersion, versionKey, versions]);

  const lineChanges = countsAreCurrent ? counts.lineChanges : {};
  const currentChanges = useMemo(() => {
    if (!open || !countsAreCurrent) {
      return null;
    }
    return countChangedLines(counts.latestSavedText, currentText);
  }, [counts, countsAreCurrent, currentText, open]);

  useEffect(
    () => () => {
      if (messageTimerRef.current !== undefined) {
        window.clearTimeout(messageTimerRef.current);
      }
    },
    [],
  );

  const showMessage = useCallback((nextMessage: string) => {
    if (messageTimerRef.current !== undefined) {
      window.clearTimeout(messageTimerRef.current);
    }
    setMessage(nextMessage);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimerRef.current = undefined;
    }, 1400);
  }, []);

  const saveVersion = useCallback(async () => {
    try {
      const result = await onSave();
      if (result) {
        showMessage(result.created ? "Saved" : "No changes");
      }
    } catch {
      // App owns the save error so the shortcut and sidebar share one state.
    }
  }, [onSave, showMessage]);

  if (!open) {
    return null;
  }

  return (
    <aside className="versions-sidebar" aria-label="Versions">
      <header className="versions-sidebar-header">
        <button
          type="button"
          className="versions-sidebar-close"
          aria-label="Close versions"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="versions-list">
        <div
          className={`versions-current${selectedVersionId === null ? " versions-item-selected" : ""}`}
        >
          <button
            type="button"
            className="versions-current-main"
            aria-pressed={selectedVersionId === null}
            onClick={onSelectCurrent}
          >
            <span className="versions-item-number">Current</span>
            <span
              className="versions-item-changes"
              aria-label={
                currentChanges
                  ? `${currentChanges.removed} lines removed and ${currentChanges.added} added compared with the latest saved version`
                  : "Calculating line changes"
              }
            >
              <span className="versions-item-removed">−{currentChanges?.removed ?? "…"}</span>
              <span className="versions-item-added">+{currentChanges?.added ?? "…"}</span>
            </span>
          </button>
          <button
            type="button"
            className="versions-current-save"
            aria-label="Save current version. Command Option S."
            title="Save current version · ⌥⌘S"
            disabled={saving}
            onClick={() => void saveVersion()}
          >
            {saving ? "Saving…" : message ?? "Save"}
          </button>
        </div>
        {versions.length === 0 && (
          <p className="versions-empty">No saved versions yet.</p>
        )}
        {versions.map((version, index) => {
          const changes = lineChanges[version.id];
          const previousVersion = versions[index + 1] ?? null;
          return (
            <button
              type="button"
              className={`versions-item${selectedVersionId === version.id ? " versions-item-selected" : ""}`}
              aria-pressed={selectedVersionId === version.id}
              key={version.id}
              onClick={() => onSelectVersion(version, previousVersion)}
            >
              <span className="versions-item-heading">
                <span className="versions-item-number">V{version.number}</span>
                <time className="versions-item-time" dateTime={new Date(version.createdMs).toISOString()}>
                  {versionTime(version.createdMs)}
                </time>
              </span>
              <span
                className="versions-item-changes"
                aria-label={
                  changes
                    ? `${changes.removed} lines removed and ${changes.added} added compared with the previous version`
                    : "Calculating line changes"
                }
              >
                <span className="versions-item-removed">−{changes?.removed ?? "…"}</span>
                <span className="versions-item-added">+{changes?.added ?? "…"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {(readError || saveError) && (
        <div className="versions-error">{readError ?? saveError}</div>
      )}
    </aside>
  );
}
