import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createVersionDiff, type VersionDiffRow } from "./versionDiff";
import {
  listDocumentVersions,
  readDocumentVersion,
  saveDocumentVersion,
  type DocumentVersion,
} from "./versions";

const CURRENT_ID = "current";

interface VersionHistoryProps {
  documentPath: string;
  currentText: string;
  beforeSave: () => Promise<void>;
  onClose: () => void;
  onVersionsChange: (count: number) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function versionLabel(version: DocumentVersion): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(version.createdMs));
}

function textPreview(text: string): string {
  const preview = text.trim().replace(/\s+/g, " ");
  return preview || "(empty)";
}

function rowLineNumber(row: VersionDiffRow): number | undefined {
  return row.kind === "removed" ? row.oldLine : row.newLine;
}

function DiffRow({ row }: { row: VersionDiffRow }) {
  if (row.kind === "gap") {
    return (
      <div className="version-diff-gap" aria-label="Unchanged text omitted">
        ···
      </div>
    );
  }

  const prefix = row.kind === "removed" ? "−" : row.kind === "added" ? "+" : " ";
  return (
    <div className={`version-diff-row version-diff-${row.kind}`}>
      <span className="version-diff-prefix" aria-hidden="true">
        {prefix}
      </span>
      <span className="version-diff-line-number" aria-hidden="true">
        {rowLineNumber(row)}
      </span>
      <span className="version-diff-text">
        {row.segments.length === 0 || row.segments.every((segment) => segment.text === "")
          ? "\u00a0"
          : row.segments.map((segment, index) =>
              segment.changed ? (
                <mark key={index}>{segment.text}</mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
      </span>
    </div>
  );
}

export function VersionHistory({
  documentPath,
  currentText,
  beforeSave,
  onClose,
  onVersionsChange,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseId, setBaseId] = useState(CURRENT_ID);
  const [compareId, setCompareId] = useState(CURRENT_ID);
  const [baseText, setBaseText] = useState(currentText);
  const [compareText, setCompareText] = useState(currentText);
  const [comparing, setComparing] = useState(false);
  const contentCacheRef = useRef(new Map<string, string>());
  const messageTimerRef = useRef<number | undefined>(undefined);

  const labelForId = useCallback(
    (id: string) => {
      if (id === CURRENT_ID) {
        return "Current";
      }
      const version = versions.find((item) => item.id === id);
      return version ? versionLabel(version) : "Version";
    },
    [versions],
  );

  useEffect(() => {
    let active = true;
    void listDocumentVersions(documentPath)
      .then((items) => {
        if (!active) {
          return;
        }
        setVersions(items);
        onVersionsChange(items.length);
        if (items[0]) {
          setBaseId(items[0].id);
        }
        setLoading(false);
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
    const loadText = async (id: string): Promise<string> => {
      if (id === CURRENT_ID) {
        return currentText;
      }
      const cached = contentCacheRef.current.get(id);
      if (cached !== undefined) {
        return cached;
      }
      const contents = await readDocumentVersion(documentPath, id);
      contentCacheRef.current.set(id, contents);
      return contents;
    };

    setComparing(true);
    setError(null);
    void Promise.all([loadText(baseId), loadText(compareId)])
      .then(([nextBaseText, nextCompareText]) => {
        if (active) {
          setBaseText(nextBaseText);
          setCompareText(nextCompareText);
          setComparing(false);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(errorText(loadError));
          setComparing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [baseId, compareId, currentText, documentPath]);

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
      contentCacheRef.current.set(result.version.id, currentText);
      setVersions((current) => {
        const withoutSaved = current.filter((item) => item.id !== result.version.id);
        const next = [result.version, ...withoutSaved];
        onVersionsChange(next.length);
        return next;
      });
      setBaseId(result.version.id);
      setCompareId(CURRENT_ID);
      showMessage(result.created ? "Version saved" : "Already saved");
    } catch (saveError) {
      setError(errorText(saveError));
    } finally {
      setSaving(false);
    }
  }, [beforeSave, currentText, documentPath, onVersionsChange, saving, showMessage]);

  const diff = useMemo(
    () => createVersionDiff(baseText, compareText),
    [baseText, compareText],
  );

  const selectBase = (id: string) => {
    setBaseId(id);
    if (id === compareId) {
      const fallback = id === CURRENT_ID ? versions[0]?.id : CURRENT_ID;
      if (fallback) {
        setCompareId(fallback);
      }
    }
  };

  return (
    <div
      className="versions-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="versions-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Versions"
      >
        <header className="versions-header">
          <div className="versions-heading">
            <span className="versions-title">Versions</span>
            {message && (
              <span className="versions-message" role="status">
                {message}
              </span>
            )}
          </div>
          <button
            type="button"
            className="versions-save"
            disabled={saving || loading}
            onClick={() => void saveVersion()}
          >
            {saving ? "Saving…" : "Save version"}
          </button>
        </header>

        <div className="versions-body">
          <aside className="versions-list" aria-label="Saved versions">
            <button
              type="button"
              className={`versions-item${baseId === CURRENT_ID ? " versions-item-selected" : ""}`}
              onClick={() => selectBase(CURRENT_ID)}
            >
              <span className="versions-item-date">Current</span>
              <span className="versions-item-preview">{textPreview(currentText)}</span>
            </button>
            {versions.map((version) => (
              <button
                type="button"
                className={`versions-item${baseId === version.id ? " versions-item-selected" : ""}`}
                key={version.id}
                onClick={() => selectBase(version.id)}
              >
                <span className="versions-item-date">{versionLabel(version)}</span>
                <span className="versions-item-preview">{version.preview}</span>
              </button>
            ))}
            {!loading && versions.length === 0 && (
              <p className="versions-empty-list">No saved versions yet.</p>
            )}
          </aside>

          <main className="versions-comparison">
            <div className="versions-compare-bar">
              <span className="versions-compare-label">{labelForId(baseId)}</span>
              <span className="versions-compare-arrow" aria-hidden="true">→</span>
              <label className="versions-compare-select-wrap">
                <span className="sr-only">Compare with</span>
                <select
                  className="versions-compare-select"
                  value={compareId}
                  onChange={(event) => setCompareId(event.target.value)}
                >
                  <option value={CURRENT_ID}>Current</option>
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      {versionLabel(version)}
                    </option>
                  ))}
                </select>
              </label>
              {!comparing && diff.rows.length > 0 && (
                <span className="versions-diff-summary">
                  <span className="versions-added">+{diff.added}</span>
                  <span className="versions-removed">−{diff.removed}</span>
                </span>
              )}
            </div>

            <div className="version-diff" aria-live="polite">
              {loading || comparing ? (
                <div className="versions-comparison-empty">Loading…</div>
              ) : versions.length === 0 ? (
                <div className="versions-comparison-empty">
                  Save a version when this draft is worth keeping.
                </div>
              ) : diff.rows.length === 0 ? (
                <div className="versions-comparison-empty">No changes.</div>
              ) : (
                diff.rows.map((row, index) => <DiffRow key={index} row={row} />)
              )}
            </div>
          </main>
        </div>
        {error && <div className="versions-error">{error}</div>}
      </section>
    </div>
  );
}
