import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef } from "react";
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
  openPicker: () => void;
}

export function useDocumentSwitch({
  path,
  text,
  setPath,
  setText,
  flush,
  markLoaded,
  openPicker,
}: UseDocumentSwitchOptions) {
  const pathRef = useRef<string | null>(null);
  const textRef = useRef("");
  const pendingNavigateRef = useRef<string | null>(null);
  const navigationChainRef = useRef(Promise.resolve());

  pathRef.current = path;
  textRef.current = text;

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
      navigationChainRef.current = navigationChainRef.current
        .catch(() => undefined)
        .then(async () => {
          while (pendingNavigateRef.current !== null) {
            const target = pendingNavigateRef.current;
            pendingNavigateRef.current = null;

            if (target === pathRef.current) {
              continue;
            }

            await flush();
            await discardPristineDraft(pathRef.current, textRef.current);
            await loadFromPath(target);
          }
        });
      return navigationChainRef.current;
    },
    [flush, loadFromPath],
  );

  const flipDocument = useCallback(
    async (direction: 1 | -1) => {
      openPicker();

      const documents = await listVaultDocuments();
      const nextPath = adjacentDocumentPath(documents, pathRef.current, direction);
      if (nextPath) {
        switchToPath(nextPath);
      }
    },
    [openPicker, switchToPath],
  );

  return { flipDocument, loadFromPath, switchToPath };
}
