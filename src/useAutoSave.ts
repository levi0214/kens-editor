import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 400;

export function useAutoSave(text: string, path: string | null) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastWrittenRef = useRef<{ path: string; text: string } | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const write = useCallback(async (targetPath: string, contents: string) => {
    const lastWritten = lastWrittenRef.current;
    if (
      lastWritten?.path === targetPath &&
      lastWritten.text === contents
    ) {
      return;
    }

    try {
      await invoke("write_text_file", { path: targetPath, contents });
      lastWrittenRef.current = { path: targetPath, text: contents };
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    if (path !== null) {
      await write(path, text);
    }
  }, [path, text, write]);

  const markLoaded = useCallback((targetPath: string, contents: string) => {
    lastWrittenRef.current = { path: targetPath, text: contents };
    setSaveError(null);
  }, []);

  useEffect(() => {
    if (path === null) {
      return;
    }

    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      void write(path, text);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [path, text, write]);

  return { flush, markLoaded, saveError };
}
