import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "./statusBarIcons";
import {
  listDocumentVersions,
  saveDocumentVersion,
  type DocumentVersion,
} from "./versions";

interface VersionHistoryProps {
  open: boolean;
  documentPath: string;
  currentText: string;
  beforeSave: () => Promise<void>;
  saveRequest: number;
  onClose: () => void;
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
  onClose,
  onVersionsChange,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

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
      showMessage(result.created ? `V${result.version.number} saved` : "Already saved");
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

      <div className="versions-sidebar-save-row">
        <button
          type="button"
          className="versions-save"
          aria-label="Save current version. Command Option S."
          title="Save current version · ⌥⌘S"
          disabled={saving || loading}
          onClick={() => void saveVersion()}
        >
          {saving ? "Saving…" : "Save current version"}
        </button>
        {message && (
          <span className="versions-message" role="status">
            {message}
          </span>
        )}
      </div>

      <div className="versions-list">
        {!loading && versions.length === 0 && (
          <p className="versions-empty">No saved versions yet.</p>
        )}
        {versions.map((version) => (
          <article className="versions-item" key={version.id}>
            <div className="versions-item-heading">
              <span className="versions-item-number">V{version.number}</span>
              <time className="versions-item-time" dateTime={new Date(version.createdMs).toISOString()}>
                {versionTime(version.createdMs)}
              </time>
            </div>
            <p className="versions-item-preview">{version.preview}</p>
          </article>
        ))}
      </div>

      {error && <div className="versions-error">{error}</div>}
    </aside>
  );
}
