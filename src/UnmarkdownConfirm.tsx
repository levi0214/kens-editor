import { useEffect, useRef } from "react";
import { KeyHints } from "./keyHint";

interface UnmarkdownConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnmarkdownConfirm({ onConfirm, onCancel }: UnmarkdownConfirmProps) {
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
      className="unmarkdown-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="unmarkdown-confirm-panel"
        role="dialog"
        aria-labelledby="unmarkdown-confirm-title"
        aria-describedby="unmarkdown-confirm-body"
      >
        <h2 id="unmarkdown-confirm-title" className="unmarkdown-confirm-title">
          Unmarkdown
        </h2>
        <p id="unmarkdown-confirm-body" className="unmarkdown-confirm-body">
          去掉部分 Markdown 标记，让内容更好读。
        </p>
        <div className="unmarkdown-confirm-actions">
          <button
            type="button"
            className="unmarkdown-confirm-btn unmarkdown-confirm-btn-cancel"
            onClick={onCancel}
          >
            <span>取消</span>
            <KeyHints keys={["Esc"]} />
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="unmarkdown-confirm-btn unmarkdown-confirm-btn-confirm"
            onClick={onConfirm}
          >
            <span>Unmarkdown</span>
            <KeyHints keys={["↵"]} />
          </button>
        </div>
      </div>
    </div>
  );
}
