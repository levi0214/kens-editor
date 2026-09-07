import { useEffect, useRef } from "react";
import { KeyHints } from "./keyHint";

interface ExportPreviewProps {
  url: string;
  width: number;
  height: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportPreview({
  url,
  width,
  height,
  onConfirm,
  onCancel,
}: ExportPreviewProps) {
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
        <div className="export-preview-head">
          <span className="export-preview-title">导出为图片</span>
          <span className="export-preview-dims" aria-live="polite">
            {width} × {height}
          </span>
        </div>
        <div className="export-preview-scroll">
          <img
            className="export-preview-img"
            src={url}
            width={width}
            height={height}
            alt="导出预览"
          />
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
