import { useEffect, useRef } from "react";
import { KeyHints } from "./keyHint";

interface ExportPreviewProps {
  url: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A single full rectangle, scaled to fit (no scrolling), with the action
// buttons below it. No title, no size readout — just the image and Export.
export function ExportPreview({ url, onConfirm, onCancel }: ExportPreviewProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="export-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="export-preview-panel"
        role="dialog"
        aria-label="Export as image"
      >
        <div className="export-preview-stage">
          <img className="export-preview-img" src={url} alt="导出预览" />
        </div>
        <div className="export-preview-actions">
          <button
            type="button"
            className="export-preview-btn export-preview-btn-cancel"
            onClick={onCancel}
          >
            <span>取消</span>
            <KeyHints keys={["Esc"]} />
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="export-preview-btn export-preview-btn-confirm"
            onClick={onConfirm}
          >
            <span>导出</span>
            <KeyHints keys={["↵"]} />
          </button>
        </div>
      </div>
    </div>
  );
}
