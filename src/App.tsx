import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import "./App.css";

function windowTitle(path: string | null, dirty: boolean): string {
  const marker = dirty ? " •" : "";

  if (path) {
    const parts = path.split(/[/\\]/);
    const name = parts[parts.length - 1] || path;
    return `${name}${marker}`;
  }

  return `Ken's Editor${marker}`;
}

function App() {
  const [text, setText] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [savedText, setSavedText] = useState("");
  const dirty = text !== savedText;

  useEffect(() => {
    void getCurrentWindow().setTitle(windowTitle(path, dirty));
  }, [path, dirty]);

  const loadFromPath = useCallback(async (filePath: string) => {
    const contents = await invoke<string>("read_text_file", { path: filePath });
    setPath(filePath);
    setText(contents);
    setSavedText(contents);
  }, []);

  const openFile = useCallback(async () => {
    const selected = await open({ multiple: false });
    if (selected === null) {
      return;
    }

    await loadFromPath(selected);
  }, [loadFromPath]);

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
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") {
          return;
        }

        const filePath = event.payload.paths[0];
        if (filePath) {
          void loadFromPath(filePath);
        }
      })
      .then((stop) => {
        unlisten = stop;
      });

    return () => {
      unlisten?.();
    };
  }, [loadFromPath]);

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

  const showStatus = path !== null || dirty;

  return (
    <div className="app">
      <textarea
        className="editor"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        autoFocus
      />
      {showStatus && (
        <footer className="statusbar">
          {path && <span className="statusbar-path">{path}</span>}
          {dirty && <span className="statusbar-flag">Not saved</span>}
        </footer>
      )}
    </div>
  );
}

export default App;
