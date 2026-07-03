import { useCallback, useState, type RefObject } from "react";
import { forgetDraft } from "./sessionDrafts";
import { unmarkdown } from "./unmarkdown";

interface UseUnmarkdownOptions {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  setText: (text: string) => void;
  path: string | null;
  ready: boolean;
  onboardingComplete: boolean;
  hideHint: () => void;
  focusEditor: (editor: HTMLTextAreaElement | null) => void;
}

export function useUnmarkdown({
  editorRef,
  text,
  setText,
  path,
  ready,
  onboardingComplete,
  hideHint,
  focusEditor,
}: UseUnmarkdownOptions) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const apply = useCallback(() => {
    const editor = editorRef.current;
    if (!onboardingComplete || !ready || !editor) {
      return;
    }

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const hasSelection = start !== end;
    const source = hasSelection ? text.slice(start, end) : text;
    const cleaned = unmarkdown(source);

    if (cleaned === source) {
      focusEditor(editor);
      return;
    }

    const next = hasSelection
      ? text.slice(0, start) + cleaned + text.slice(end)
      : cleaned;

    setText(next);

    if (next.length > 0 && path) {
      forgetDraft(path);
    }

    requestAnimationFrame(() => {
      const cursor = hasSelection ? start + cleaned.length : cleaned.length;
      editor.focus();
      editor.setSelectionRange(cursor, cursor);
    });
  }, [editorRef, focusEditor, onboardingComplete, path, ready, setText, text]);

  const openConfirm = useCallback(() => {
    if (!onboardingComplete || !ready || confirmOpen) {
      return;
    }

    hideHint();
    setConfirmOpen(true);
  }, [confirmOpen, hideHint, onboardingComplete, ready]);

  const confirm = useCallback(() => {
    setConfirmOpen(false);
    apply();
  }, [apply]);

  const cancel = useCallback(() => {
    setConfirmOpen(false);
    focusEditor(editorRef.current);
  }, [editorRef, focusEditor]);

  return { confirmOpen, openConfirm, confirm, cancel };
}
