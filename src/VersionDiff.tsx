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
  previousVersion: DocumentVersion | null;
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

  return (
    <div className={`version-diff-line version-diff-line-${line.kind}`}>
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
  previousVersion,
  onClose,
}: VersionDiffProps) {
  const [texts, setTexts] = useState<{ previous: string; selected: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setTexts(null);
    setError(null);

    void Promise.all([
      previousVersion
        ? readDocumentVersion(documentPath, previousVersion.id)
        : Promise.resolve(""),
      readDocumentVersion(documentPath, version.id),
    ])
      .then(([previous, selected]) => {
        if (active) {
          setTexts({ previous, selected });
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
  }, [documentPath, previousVersion, version.id]);

  const diff = useMemo(
    () => (texts === null ? null : buildDocumentDiff(texts.previous, texts.selected)),
    [texts],
  );
  const splitRows = useMemo(
    () => (diff === null ? [] : splitDocumentDiffLines(diff.lines)),
    [diff],
  );

  return (
    <section
      className="version-diff"
      aria-label={
        previousVersion
          ? `V${version.number} compared with V${previousVersion.number}`
          : `V${version.number} compared with the blank start`
      }
    >
      <header className="version-diff-header">
        <span className="version-diff-title version-diff-title-unified">
          <span>{previousVersion ? `V${previousVersion.number}` : "Start"}</span>
          <span className="version-diff-arrow" aria-hidden="true">
            →
          </span>
          <strong>V{version.number}</strong>
        </span>
        <span className="version-diff-title-split" aria-hidden="true">
          <span>{previousVersion ? `V${previousVersion.number}` : "Start"}</span>
          <strong>V{version.number}</strong>
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
            <p className="version-diff-state">No changes in V{version.number}.</p>
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
