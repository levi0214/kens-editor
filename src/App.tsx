import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyFontSize,
  FONT_SIZE_PRESETS,
  nextFontSize,
  storedFontSize,
  type FontSize,
} from "./fontSize";
import {
  applyMaxWidth,
  MAX_WIDTH_LABELS,
  storedMaxWidth,
  toggleMaxWidth,
  type MaxWidthMode,
} from "./maxWidth";
import {
  applyWrap,
  storedWrap,
  toggleWrap,
  WRAP_LABELS,
  type WrapMode,
} from "./wrap";
import { windowTitle } from "./windowTitle";
import "./App.css";

function focusEditor(editor: HTMLTextAreaElement | null): void {
  void getCurrentWindow().setFocus();
  editor?.focus();
}

function startWindowDrag(event: React.MouseEvent<HTMLElement>): void {
  if (event.button !== 0) {
    return;
  }

  void getCurrentWindow().startDragging();
}

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [savedText, setSavedText] = useState("");
  const [fontSize, setFontSize] = useState<FontSize>(storedFontSize);
  const [wrap, setWrap] = useState<WrapMode>(storedWrap);
  const [maxWidth, setMaxWidth] = useState<MaxWidthMode>(storedMaxWidth);
  const dirty = text !== savedText;

  const cycleFontSize = useCallback(() => {
    setFontSize((current) => {
      const next = nextFontSize(current);
      applyFontSize(next);
      return next;
    });
  }, []);

  const toggleLineWrap = useCallback(() => {
    setWrap((current) => {
      const next = toggleWrap(current);
      applyWrap(next);
      return next;
    });
  }, []);

  const toggleContentWidth = useCallback(() => {
    setMaxWidth((current) => {
      const next = toggleMaxWidth(current);
      applyMaxWidth(next);
      return next;
    });
  }, []);

  const fontSizePixels = FONT_SIZE_PRESETS[fontSize];
  const wrapLabel = WRAP_LABELS[wrap];
  const maxWidthLabel = MAX_WIDTH_LABELS[maxWidth];

  useEffect(() => {
    const editor = editorRef.current;
    const onReady = () => focusEditor(editor);

    onReady();
    window.addEventListener("kens-editor-ready", onReady);
    return () => window.removeEventListener("kens-editor-ready", onReady);
  }, []);

  useEffect(() => {
    const title = windowTitle(path, dirty);
    document.title = title;
    void getCurrentWindow().setTitle(title);
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

  return (
    <div className="app">
      <div
        className="titlebar-drag"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      />
      <div className="editor-shell">
        <textarea
          ref={editorRef}
          className="editor"
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          wrap={wrap === "wrap" ? "soft" : "off"}
        />
      </div>
      <footer className="statusbar">
        <div className="statusbar-left">
          {dirty && <span className="statusbar-flag">Not saved</span>}
        </div>
        <div className="statusbar-controls">
          <button
            type="button"
            className="statusbar-toggle"
            aria-label={`Font size, ${fontSizePixels}px. Click to change.`}
            onClick={cycleFontSize}
          >
            <span className="statusbar-toggle-icon" aria-hidden="true">
              Aa
            </span>
            <span className="statusbar-toggle-value">{fontSizePixels}</span>
          </button>
          <button
            type="button"
            className="statusbar-toggle"
            aria-label={`Line wrap, ${wrap === "wrap" ? "on" : "off"}. Click to toggle.`}
            onClick={toggleLineWrap}
          >
            {wrapLabel}
          </button>
          <button
            type="button"
            className="statusbar-toggle"
            aria-label={`Content width, ${maxWidth === "full" ? "full window" : "narrow column"}. Click to toggle.`}
            onClick={toggleContentWidth}
          >
            {maxWidthLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
