import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildDocumentDiff,
  splitDocumentDiffLines,
  type DocumentDiffLine,
} from "./documentDiff";
import { CloseIcon } from "./statusBarIcons";
import { type DocumentVersion } from "./versions";

interface VersionDiffProps {
  documentPath: string;
  readVersion: (versionId: string) => Promise<string>;
  readAttempt: number;
  version: DocumentVersion;
  previousVersion: DocumentVersion | null;
  onClose: () => void;
  onRetry: () => void;
}

type DiffLoadState =
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      readAttempt: number;
      status: "loading";
    }
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      readAttempt: number;
      status: "loaded";
      previous: string;
      selected: string;
    }
  | {
      documentPath: string;
      previousVersionId: string | null;
      versionId: string;
      readAttempt: number;
      status: "error";
      message: string;
    };

function loadStateMatches(
  state: DiffLoadState | null,
  documentPath: string,
  previousVersionId: string | null,
  versionId: string,
  readAttempt: number,
): state is DiffLoadState {
  return (
    state !== null &&
    state.documentPath === documentPath &&
    state.previousVersionId === previousVersionId &&
    state.versionId === versionId &&
    state.readAttempt === readAttempt
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function diffLineKey(line: DocumentDiffLine): string | null {
  if (line.kind === "separator") {
    return null;
  }
  return `${line.kind}:${line.oldNumber ?? ""}:${line.newNumber ?? ""}`;
}

function DiffLine({
  line,
  onExpand,
}: {
  line: DocumentDiffLine;
  onExpand: (button: HTMLButtonElement) => void;
}) {
  if (line.kind === "separator") {
    return (
      <button
        type="button"
        className="version-diff-separator"
        aria-label="Show full document"
        onClick={(event) => onExpand(event.currentTarget)}
      >
        ···
      </button>
    );
  }

  return (
    <div
      className={`version-diff-line version-diff-line-${line.kind}`}
      data-diff-line-key={diffLineKey(line)}
    >
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
  readVersion,
  readAttempt,
  version,
  previousVersion,
  onClose,
  onRetry,
}: VersionDiffProps) {
  const [loadState, setLoadState] = useState<DiffLoadState | null>(null);
  const [showFullDocument, setShowFullDocument] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingAnchorRef = useRef<{
    key: string | null;
    top: number;
    view: "unified" | "split";
  } | null>(null);
  const previousVersionId = previousVersion?.id ?? null;
  const currentLoadState = loadStateMatches(
    loadState,
    documentPath,
    previousVersionId,
    version.id,
    readAttempt,
  )
    ? loadState
    : null;

  useEffect(() => {
    let active = true;
    setLoadState({
      documentPath,
      previousVersionId,
      versionId: version.id,
      readAttempt,
      status: "loading",
    });

    void Promise.all([
      previousVersionId
        ? readVersion(previousVersionId)
        : Promise.resolve(""),
      readVersion(version.id),
    ])
      .then(([previous, selected]) => {
        if (active) {
          setLoadState({
            documentPath,
            previousVersionId,
            versionId: version.id,
            readAttempt,
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
            readAttempt,
            status: "error",
            message: errorText(readError),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [documentPath, previousVersionId, readAttempt, readVersion, version.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [version.id]);

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
  const expandFrom = useCallback(
    (button: HTMLButtonElement, view: "unified" | "split") => {
      const previous = button.previousElementSibling;
      const anchor = previous?.matches("[data-diff-line-key]")
        ? (previous as HTMLElement)
        : previous?.querySelector<HTMLElement>("[data-diff-line-key]") ?? null;
      pendingAnchorRef.current = {
        key: anchor?.dataset.diffLineKey ?? null,
        top: (anchor ?? button).getBoundingClientRect().top,
        view,
      };
      setShowFullDocument(true);
    },
    [],
  );

  useLayoutEffect(() => {
    const pending = pendingAnchorRef.current;
    const scroll = scrollRef.current;
    if (!showFullDocument || !pending || !scroll) {
      return;
    }

    const view = scroll.querySelector(`.version-diff-${pending.view}`);
    const lines = Array.from(
      view?.querySelectorAll<HTMLElement>("[data-diff-line-key]") ?? [],
    );
    const target = pending.key
      ? lines.find((line) => line.dataset.diffLineKey === pending.key)
      : lines[0];
    if (target) {
      scroll.scrollTop += target.getBoundingClientRect().top - pending.top;
    }
    pendingAnchorRef.current = null;
  }, [diff, showFullDocument]);

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
              onClick={() => {
                pendingAnchorRef.current = null;
                setShowFullDocument(false);
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = 0;
                }
              }}
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
            <div
              className="version-diff-state version-diff-state-error"
              role="alert"
              title={currentLoadState.message}
            >
              <span>Could not load diff</span>
              <button type="button" onClick={onRetry}>
                Retry
              </button>
            </div>
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
                    onExpand={(button) => expandFrom(button, "unified")}
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
                      onClick={(event) =>
                        expandFrom(event.currentTarget, "split")
                      }
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
