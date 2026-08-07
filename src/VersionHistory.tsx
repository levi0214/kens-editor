import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countChangedLines,
  type DocumentLineChanges,
} from "./documentDiff";
import { CloseIcon } from "./statusBarIcons";
import {
  listDocumentVersions,
  readDocumentVersion,
  saveDocumentVersion,
  type DocumentVersion,
} from "./versions";

interface VersionHistoryProps {
  open: boolean;
  documentPath: string;
  currentText: string;
  beforeSave: () => Promise<void>;
  saveRequest: number;
  selectedVersionId: string | null;
  onClose: () => void;
  onSelectCurrent: () => void;
  onSelectVersion: (
    version: DocumentVersion,
    previousVersion: DocumentVersion | null,
  ) => void;
  onVersionsChange: (count: number) => void;
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
  beforeSave,
  saveRequest,
  selectedVersionId,
  onClose,
  onSelectCurrent,
  onSelectVersion,
  onVersionsChange,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lineChanges, setLineChanges] = useState<Record<string, DocumentLineChanges>>({});
  const [latestSavedText, setLatestSavedText] = useState<string | null>(null);
  const messageTimerRef = useRef<number | undefined>(undefined);
  const handledSaveRequestRef = useRef(saveRequest);

  useEffect(() => {
    let active = true;
    void listDocumentVersions(documentPath)
      .then((items) => {
        if (active) {
          setVersions(items);
          onVersionsChange(items.length);
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
  }, [documentPath, onVersionsChange]);

  useEffect(() => {
    let active = true;
    setLineChanges({});
    setLatestSavedText(null);

    const chronological = [...versions].reverse();
    void Promise.all(
      chronological.map((version) => readDocumentVersion(documentPath, version.id)),
    )
      .then((contents) => {
        if (!active) {
          return;
        }

        let previous = "";
        const next: Record<string, DocumentLineChanges> = {};
        chronological.forEach((version, index) => {
          next[version.id] = countChangedLines(previous, contents[index]);
          previous = contents[index];
        });
        setLineChanges(next);
        setLatestSavedText(previous);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [documentPath, versions]);

  const currentChanges = useMemo(
    () =>
      latestSavedText === null
        ? null
        : countChangedLines(latestSavedText, currentText),
    [currentText, latestSavedText],
  );

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
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await beforeSave();
      const result = await saveDocumentVersion(documentPath, currentText);
      const withoutSaved = versions.filter((item) => item.id !== result.version.id);
      const next = [result.version, ...withoutSaved];
      setVersions(next);
      onVersionsChange(next.length);
      showMessage(result.created ? "Saved" : "No changes");
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  }, [beforeSave, currentText, documentPath, onVersionsChange, saving, showMessage, versions]);

  useEffect(() => {
    if (saveRequest === handledSaveRequestRef.current) {
      return;
    }

    handledSaveRequestRef.current = saveRequest;
    void saveVersion();
  }, [saveRequest, saveVersion]);

  return (
    <aside className="versions-sidebar" aria-label="Versions" hidden={!open}>
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
            disabled={saving || loading}
            onClick={() => void saveVersion()}
          >
            {saving ? "Saving…" : message ?? "Save"}
          </button>
        </div>
        {!loading && versions.length === 0 && (
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

      {error && <div className="versions-error">{error}</div>}
    </aside>
  );
}
