import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import { adjacentDocumentPath } from "./documentNav";
import { discardPristineDraft } from "./sessionDrafts";
import { listVaultDocuments } from "./vault";

interface UseDocumentSwitchOptions {
  path: string | null;
  text: string;
  setPath: (path: string | null) => void;
  setText: (text: string) => void;
  flush: () => Promise<void>;
  markLoaded: (path: string, text: string) => void;
}

export function useDocumentSwitch({
  path,
  text,
  setPath,
  setText,
  flush,
  markLoaded,
}: UseDocumentSwitchOptions) {
  const pathRef = useRef<string | null>(null);
  const textRef = useRef("");
  const pendingNavigateRef = useRef<string | null>(null);
  const navigationChainRef = useRef(Promise.resolve());
  // Picker highlight; updates immediately while the editor path may still be loading.
  const [listPath, setListPath] = useState<string | null>(null);
  const listPathRef = useRef<string | null>(null);

  pathRef.current = path;
  textRef.current = text;
  listPathRef.current = listPath;

  const loadFromPath = useCallback(
    async (filePath: string) => {
      const contents = await invoke<string>("read_text_file", { path: filePath });
      setPath(filePath);
      setText(contents);
      pathRef.current = filePath;
      textRef.current = contents;
      markLoaded(filePath, contents);
    },
    [markLoaded, setPath, setText],
  );

  const switchToPath = useCallback(
    (filePath: string) => {
      pendingNavigateRef.current = filePath;
      setListPath(filePath);
      navigationChainRef.current = navigationChainRef.current
        .catch(() => undefined)
        .then(async () => {
          while (pendingNavigateRef.current !== null) {
            const target = pendingNavigateRef.current;
            pendingNavigateRef.current = null;

            if (target === pathRef.current) {
              continue;
            }

            const superseded = () => pendingNavigateRef.current !== null;

            await flush();
            await discardPristineDraft(pathRef.current, textRef.current);
            if (superseded()) {
              continue;
            }
            await loadFromPath(target);
          }

          setListPath(null);
        });
      return navigationChainRef.current;
    },
    [flush, loadFromPath],
  );

  const flipDocument = useCallback(
    async (direction: 1 | -1): Promise<boolean> => {
      const documents = await listVaultDocuments();
      const from = listPathRef.current ?? pathRef.current;
      const nextPath = adjacentDocumentPath(documents, from, direction);
      if (!nextPath) {
        return false;
      }
      switchToPath(nextPath);
      return true;
    },
    [switchToPath],
  );

  return { flipDocument, loadFromPath, switchToPath, listPath };
}
