import { useEffect, useMemo, useRef, useState } from "react";
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

type DiffLoadState =
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      status: "loading";
    }
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      status: "loaded";
      previous: string;
      selected: string;
    }
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      status: "error";
      message: string;
    };

function loadStateMatches(
  state: DiffLoadState | null,
  documentPath: string,
  previousVersionId: string | null,
  versionId: string,
): state is DiffLoadState {
  return (
    state !== null &&
    state.documentPath === documentPath &&
    state.previousVersionId === previousVersionId &&
    state.versionId === versionId
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function DiffLine({
  line,
  onExpand,
}: {
  line: DocumentDiffLine;
  onExpand: () => void;
}) {
  if (line.kind === "separator") {
    return (
      <button
        type="button"
        className="version-diff-separator"
        aria-label="Show full document"
        onClick={onExpand}
      >
        ···
      </button>
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
  const [loadState, setLoadState] = useState<DiffLoadState | null>(null);
  const [showFullDocument, setShowFullDocument] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousVersionId = previousVersion?.id ?? null;
  const currentLoadState = loadStateMatches(
    loadState,
    documentPath,
    previousVersionId,
    version.id,
  )
    ? loadState
    : null;

  useEffect(() => {
    let active = true;
    setLoadState({
      documentPath,
      previousVersionId,
      versionId: version.id,
      status: "loading",
    });

    void Promise.all([
      previousVersionId
        ? readDocumentVersion(documentPath, previousVersionId)
        : Promise.resolve(""),
      readDocumentVersion(documentPath, version.id),
    ])
      .then(([previous, selected]) => {
        if (active) {
          setLoadState({
            documentPath,
            previousVersionId,
            versionId: version.id,
            status: "loaded",
            previous,
            selected,
          });
        }
      })
      .catch((readError) => {
        if (active) {
          setLoadState({
            documentPath,
            previousVersionId,
            versionId: version.id,
            status: "error",
            message: errorText(readError),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [documentPath, previousVersionId, version.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [showFullDocument, version.id]);

  const diff = useMemo(
    () =>
      currentLoadState?.status !== "loaded"
        ? null
        : buildDocumentDiff(
            currentLoadState.previous,
            currentLoadState.selected,
            showFullDocument ? null : 4,
          ),
    [currentLoadState, showFullDocument],
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
        <span className="version-diff-controls">
          {showFullDocument && (
            <button
              type="button"
              className="version-diff-view-toggle"
              onClick={() => setShowFullDocument(false)}
            >
              Changes only
            </button>
          )}
          <button
            type="button"
            className="version-diff-close"
            aria-label="Close diff"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </span>
      </header>

      <div className="version-diff-scroll" ref={scrollRef}>
        <div className="version-diff-content">
          {currentLoadState?.status === "error" ? (
            <p className="version-diff-state version-diff-state-error">
              {currentLoadState.message}
            </p>
          ) : diff === null ? (
            <p className="version-diff-state">Loading…</p>
          ) : !diff.hasChanges ? (
            <p className="version-diff-state">No changes in V{version.number}.</p>
          ) : (
            <>
              <div className="version-diff-unified">
                {diff.lines.map((line, index) => (
                  <DiffLine
                    line={line}
                    onExpand={() => setShowFullDocument(true)}
                    key={index}
                  />
                ))}
              </div>
              <div className="version-diff-split">
                {splitRows.map((row, index) =>
                  row.kind === "separator" ? (
                    <button
                      type="button"
                      className="version-diff-split-separator"
                      aria-label="Show full document"
                      onClick={() => setShowFullDocument(true)}
                      key={index}
                    >
                      ···
                    </button>
                  ) : (
                    <div className="version-diff-split-row" key={index}>
                      <div className="version-diff-split-cell">
                        {row.left && (
                          <DiffLine
                            line={row.left}
                            onExpand={() => setShowFullDocument(true)}
                          />
                        )}
                      </div>
                      <div className="version-diff-split-cell version-diff-split-cell-right">
                        {row.right && (
                          <DiffLine
                            line={row.right}
                            onExpand={() => setShowFullDocument(true)}
                          />
                        )}
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
