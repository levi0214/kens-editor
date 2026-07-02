import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import "./App.css";

function fileName(path: string | null): string {
  if (!path) {
    return "Untitled";
  }

  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || "Untitled";
}

function windowTitle(path: string | null, dirty: boolean): string {
  const marker = dirty ? " •" : "";
  return `${fileName(path)}${marker} — Ken's Editor`;
}

function App() {
  const [text, setText] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [savedText, setSavedText] = useState("");
  const dirty = text !== savedText;

  useEffect(() => {
    void getCurrentWindow().setTitle(windowTitle(path, dirty));
  }, [path, dirty]);

  const openFile = useCallback(async () => {
    const selected = await open({ multiple: false });
    if (selected === null) {
      return;
    }

    const contents = await invoke<string>("read_text_file", { path: selected });
    setPath(selected);
    setText(contents);
    setSavedText(contents);
  }, []);

  const saveToPath = useCallback(async (targetPath: string) => {
    await invoke("write_text_file", { path: targetPath, contents: text });
    setPath(targetPath);
    setSavedText(text);
  }, [text]);

  const saveFile = useCallback(async () => {
    if (path === null) {
      const selected = await save({});
      if (selected === null) {
        return;
      }
      await saveToPath(selected);
      return;
    }

    await saveToPath(path);
  }, [path, saveToPath]);

  const saveFileAs = useCallback(async () => {
    const selected = await save({ defaultPath: path ?? undefined });
    if (selected === null) {
      return;
    }
    await saveToPath(selected);
  }, [path, saveToPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "o") {
        event.preventDefault();
        void openFile();
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void saveFileAs();
      } else if (key === "s") {
        event.preventDefault();
        void saveFile();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openFile, saveFile, saveFileAs]);

  return (
    <textarea
      className="editor"
      value={text}
      onChange={(event) => setText(event.target.value)}
      spellCheck={false}
      autoFocus
    />
  );
}

export default App;
