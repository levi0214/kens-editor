import { useEffect, useMemo, useState } from "react";
import {
  buildDocumentDiff,
  splitDocumentDiffLines,
  type DocumentDiffLine,
} from "./documentDiff";
import { CloseIcon } from "./statusBarIcons";
import { readDocumentVersion, type DocumentVersion } from "./versions";

interface VersionDiffProps {
  documentPath: string;
  version: DocumentVersion;
  currentText: string;
  onClose: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function DiffLine({ line }: { line: DocumentDiffLine }) {
  if (line.kind === "separator") {
    return (
      <div className="version-diff-separator" aria-hidden="true">
        ···
      </div>
    );
  }

  const marker = line.kind === "added" ? "+" : line.kind === "removed" ? "−" : "";

  return (
    <div className={`version-diff-line version-diff-line-${line.kind}`}>
      <span className="version-diff-marker" aria-hidden="true">
        {marker}
      </span>
      <span className="version-diff-line-text">
        {line.spans
          ? line.spans.map((span, index) => (
              <span
                className={span.changed ? "version-diff-word-changed" : undefined}
                key={`${index}-${span.text}`}
              >
                {span.text}
              </span>
            ))
          : line.text}
      </span>
    </div>
  );
}

export function VersionDiff({
  documentPath,
  version,
  currentText,
  onClose,
}: VersionDiffProps) {
  const [savedText, setSavedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSavedText(null);
    setError(null);

    void readDocumentVersion(documentPath, version.id)
      .then((contents) => {
        if (active) {
          setSavedText(contents);
        }
      })
      .catch((readError) => {
        if (active) {
          setError(errorText(readError));
        }
      });

    return () => {
      active = false;
    };
  }, [documentPath, version.id]);

  const diff = useMemo(
    () => (savedText === null ? null : buildDocumentDiff(savedText, currentText)),
    [currentText, savedText],
  );
  const splitRows = useMemo(
    () => (diff === null ? [] : splitDocumentDiffLines(diff.lines)),
    [diff],
  );

  return (
    <section className="version-diff" aria-label={`V${version.number} compared with current`}>
      <header className="version-diff-header">
        <span className="version-diff-title">
          <strong>V{version.number}</strong>
          <span className="version-diff-arrow" aria-hidden="true">
            →
          </span>
          <span>Current</span>
        </span>
        <button
          type="button"
          className="version-diff-close"
          aria-label="Close diff"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="version-diff-scroll">
        <div className="version-diff-content">
          {error ? (
            <p className="version-diff-state version-diff-state-error">{error}</p>
          ) : diff === null ? (
            <p className="version-diff-state">Loading…</p>
          ) : !diff.hasChanges ? (
            <p className="version-diff-state">No changes from V{version.number}.</p>
          ) : (
            <>
              <div className="version-diff-unified">
                {diff.lines.map((line, index) => (
                  <DiffLine line={line} key={index} />
                ))}
              </div>
              <div className="version-diff-split">
                {splitRows.map((row, index) =>
                  row.kind === "separator" ? (
                    <div className="version-diff-split-separator" aria-hidden="true" key={index}>
                      ···
                    </div>
                  ) : (
                    <div className="version-diff-split-row" key={index}>
                      <div className="version-diff-split-cell">
                        {row.left && <DiffLine line={row.left} />}
                      </div>
                      <div className="version-diff-split-cell version-diff-split-cell-right">
                        {row.right && <DiffLine line={row.right} />}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
