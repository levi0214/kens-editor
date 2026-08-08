import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countChangedLines,
  type DocumentLineChanges,
} from "./documentDiff";
import { ChromeHint } from "./keyHint";
import { CheckIcon, CloseIcon, TrashIcon } from "./statusBarIcons";
import {
  type DocumentVersion,
  type SaveVersionResult,
} from "./versions";

interface VersionHistoryProps {
  open: boolean;
  documentPath: string;
  currentText: string;
  versions: DocumentVersion[];
  catalogError: string | null;
  readAttempt: number;
  saving: boolean;
  saveError: string | null;
  readVersion: (versionId: string) => Promise<string>;
  onSave: () => Promise<SaveVersionResult | null>;
  onDelete: (versionId: string) => Promise<void>;
  onRetryCatalog: () => void;
  onRetryReads: () => void;
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
  catalogError,
  readAttempt,
  saving,
  saveError,
  readVersion,
  onSave,
  onDelete,
  onRetryCatalog,
  onRetryReads,
  selectedVersionId,
  onClose,
  onSelectCurrent,
  onSelectVersion,
}: VersionHistoryProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    documentPath: string;
    versionKey: string;
    lineChanges: Record<string, DocumentLineChanges>;
    latestSavedText: string | null;
  } | null>(null);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const versionKey = useMemo(
    () => versions.map((version) => version.id).join("\n"),
    [versions],
  );
  const countsAreCurrent =
    counts?.documentPath === documentPath && counts.versionKey === versionKey;

  useEffect(() => {
    if (!open || catalogError || countsAreCurrent) {
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
          latestSavedText: chronological.length === 0 ? null : previous,
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
  }, [
    catalogError,
    countsAreCurrent,
    documentPath,
    open,
    readAttempt,
    readVersion,
    versionKey,
    versions,
  ]);

  const lineChanges = countsAreCurrent ? counts.lineChanges : {};
  const currentChanges = useMemo(() => {
    if (!open || !countsAreCurrent) {
      return null;
    }
    return countChangedLines(counts.latestSavedText ?? "", currentText);
  }, [counts, countsAreCurrent, currentText, open]);
  const saveIsRedundant =
    countsAreCurrent &&
    counts.latestSavedText !== null &&
    currentText === counts.latestSavedText;

  useEffect(
    () => () => {
      if (messageTimerRef.current !== undefined) {
        window.clearTimeout(messageTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setDeleteError(null);
    setConfirmDeleteId(null);
    setDeletingId(null);
  }, [documentPath]);

  useEffect(() => {
    if (!open) {
      setConfirmDeleteId(null);
    }
  }, [open]);

  useEffect(() => {
    if (
      confirmDeleteId &&
      !versions.some((version) => version.id === confirmDeleteId)
    ) {
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, versions]);

  useEffect(() => {
    confirmDeleteRef.current?.focus();
  }, [confirmDeleteId]);

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

  const retryLoad = useCallback(() => {
    setReadError(null);
    if (catalogError) {
      onRetryCatalog();
    } else {
      onRetryReads();
    }
  }, [catalogError, onRetryCatalog, onRetryReads]);

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

  const deleteVersion = useCallback(
    async (version: DocumentVersion) => {
      setDeletingId(version.id);
      setDeleteError(null);
      try {
        await onDelete(version.id);
        setConfirmDeleteId(null);
      } catch (error) {
        setDeleteError(errorText(error));
      } finally {
        setDeletingId(null);
      }
    },
    [onDelete],
  );

  if (!open) {
    return null;
  }

  return (
    <aside className="versions-sidebar" aria-label="Versions">
      <header className="versions-sidebar-header">
        <span className="versions-sidebar-title">Versions</span>
        <button
          type="button"
          className="versions-sidebar-close"
          aria-label="Close versions"
          aria-keyshortcuts={selectedVersionId === null ? "Escape" : undefined}
          onClick={onClose}
        >
          <CloseIcon />
          <ChromeHint
            name={selectedVersionId === null ? "Close" : "Close versions"}
            keys={selectedVersionId === null ? ["Esc"] : undefined}
            className="chrome-tip-below chrome-tip-right version-action-tip"
            visible={false}
          />
        </button>
      </header>

      <div className="versions-list" hidden={catalogError !== null}>
        <div
          className={`versions-current${selectedVersionId === null ? " versions-item-selected" : ""}`}
        >
          <button
            type="button"
            className="versions-current-main"
            aria-pressed={selectedVersionId === null}
            onClick={() => {
              setConfirmDeleteId(null);
              onSelectCurrent();
            }}
          >
            <span className="versions-item-number">Current</span>
            <span
              className="versions-item-changes"
              aria-label={
                readError
                  ? "Line changes unavailable"
                  : currentChanges
                    ? `${currentChanges.removed} lines removed and ${currentChanges.added} added compared with the latest saved version`
                    : "Calculating line changes"
              }
            >
              <span
                className="versions-item-removed"
                data-zero={currentChanges?.removed === 0 || undefined}
              >
                −{readError ? "—" : currentChanges?.removed ?? "…"}
              </span>
              <span
                className="versions-item-added"
                data-zero={currentChanges?.added === 0 || undefined}
              >
                +{readError ? "—" : currentChanges?.added ?? "…"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="versions-current-save"
            aria-label="Save current version. Command Option S."
            title="Save current version · ⌥⌘S"
            disabled={saving || saveIsRedundant}
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
          const confirmingDelete = confirmDeleteId === version.id;
          const deleting = deletingId === version.id;
          return (
            <div
              className={`versions-item-row${selectedVersionId === version.id ? " versions-item-selected" : ""}${confirmingDelete ? " versions-item-confirming-delete" : ""}`}
              key={version.id}
            >
              <button
                type="button"
                className="versions-item versions-item-main"
                aria-pressed={selectedVersionId === version.id}
                onClick={() => {
                  setConfirmDeleteId(null);
                  onSelectVersion(version, previousVersion);
                }}
              >
                <span className="versions-item-heading">
                  <span className="versions-item-number">V{version.number}</span>
                  <time
                    className="versions-item-time"
                    dateTime={new Date(version.createdMs).toISOString()}
                  >
                    {versionTime(version.createdMs)}
                  </time>
                </span>
                <span
                  className="versions-item-changes"
                  aria-label={
                    readError
                      ? "Line changes unavailable"
                      : changes
                        ? `${changes.removed} lines removed and ${changes.added} added compared with the previous version`
                        : "Calculating line changes"
                  }
                >
                  <span
                    className="versions-item-removed"
                    data-zero={changes?.removed === 0 || undefined}
                  >
                    −{readError ? "—" : changes?.removed ?? "…"}
                  </span>
                  <span
                    className="versions-item-added"
                    data-zero={changes?.added === 0 || undefined}
                  >
                    +{readError ? "—" : changes?.added ?? "…"}
                  </span>
                </span>
              </button>
              <span className="versions-item-actions">
                {confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      className="versions-item-delete-cancel"
                      aria-label={`Cancel deleting V${version.number}`}
                      disabled={deleting}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      <CloseIcon />
                    </button>
                    <button
                      ref={confirmDeleteRef}
                      type="button"
                      className="versions-item-delete-confirm"
                      aria-label={`Delete V${version.number}`}
                      disabled={deleting}
                      onClick={() => void deleteVersion(version)}
                    >
                      <CheckIcon />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="versions-item-delete"
                    aria-label={`Delete V${version.number}`}
                    disabled={deletingId !== null}
                    onClick={() => setConfirmDeleteId(version.id)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {catalogError || readError ? (
        <div
          className="versions-error"
          role="alert"
          title={catalogError ?? readError ?? undefined}
        >
          <span>Could not load history</span>
          <button type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      ) : deleteError ? (
        <div className="versions-error" role="alert">{deleteError}</div>
      ) : saveError ? (
        <div className="versions-error" role="alert">{saveError}</div>
      ) : null}
    </aside>
  );
}
