import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentPicker } from "./DocumentPicker";
import {
  FontSizeIcon,
  FullWidthIcon,
  NarrowWidthIcon,
  PlusIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  ThemeSystemIcon,
  WrapOffIcon,
  WrapOnIcon,
} from "./statusBarIcons";
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
import {
  applyTheme,
  nextTheme,
  storedTheme,
  THEME_LABELS,
  type ThemeMode,
} from "./theme";
import { useAutoSave } from "./useAutoSave";
import {
  createVaultDocument,
  mostRecentVaultDocument,
} from "./vault";
import { documentLabel, windowTitle } from "./windowTitle";
import "./App.css";

const NEW_DOC_PULSE_MS = 900;

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
  const pulseTimerRef = useRef<number | undefined>(undefined);
  const [text, setText] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newDocPulse, setNewDocPulse] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(storedFontSize);
  const [wrap, setWrap] = useState<WrapMode>(storedWrap);
  const [maxWidth, setMaxWidth] = useState<MaxWidthMode>(storedMaxWidth);
  const [theme, setTheme] = useState<ThemeMode>(storedTheme);
  const { flush, markLoaded, saveError } = useAutoSave(text, path);

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

  const cycleTheme = useCallback(() => {
    setTheme((current) => {
      const next = nextTheme(current);
      void applyTheme(next);
      return next;
    });
  }, []);

  const fontSizePixels = FONT_SIZE_PRESETS[fontSize];

  useEffect(() => {
    const editor = editorRef.current;
    const onReady = () => focusEditor(editor);

    onReady();
    window.addEventListener("kens-editor-ready", onReady);
    return () => window.removeEventListener("kens-editor-ready", onReady);
  }, []);

  useEffect(() => {
    const title = windowTitle(path, text);
    document.title = title;
    void getCurrentWindow().setTitle(title);
  }, [path, text]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== undefined) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const pulseNewDocument = useCallback(() => {
    setNewDocPulse(true);

    if (pulseTimerRef.current !== undefined) {
      window.clearTimeout(pulseTimerRef.current);
    }

    pulseTimerRef.current = window.setTimeout(() => {
      setNewDocPulse(false);
      pulseTimerRef.current = undefined;
    }, NEW_DOC_PULSE_MS);
  }, []);

  const loadFromPath = useCallback(
    async (filePath: string) => {
      const contents = await invoke<string>("read_text_file", { path: filePath });
      setPath(filePath);
      setText(contents);
      markLoaded(filePath, contents);
    },
    [markLoaded],
  );

  const switchToPath = useCallback(
    async (filePath: string) => {
      if (filePath === path) {
        return;
      }

      await flush();
      await loadFromPath(filePath);
    },
    [flush, loadFromPath, path],
  );

  const newDocument = useCallback(async () => {
    if (text.length === 0) {
      pulseNewDocument();
      focusEditor(editorRef.current);
      return;
    }

    await flush();
    const filePath = await createVaultDocument();
    setPath(filePath);
    setText("");
    markLoaded(filePath, "");
    pulseNewDocument();
    focusEditor(editorRef.current);
  }, [flush, markLoaded, pulseNewDocument, text]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const recent = await mostRecentVaultDocument();
      const filePath = recent ?? (await createVaultDocument());

      if (!active) {
        return;
      }

      await loadFromPath(filePath);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [loadFromPath]);

  const openFile = useCallback(async () => {
    const selected = await open({ multiple: false });
    if (selected === null) {
      return;
    }

    await switchToPath(selected);
  }, [switchToPath]);

  const saveToPath = useCallback(
    async (targetPath: string) => {
      await invoke("write_text_file", { path: targetPath, contents: text });
      setPath(targetPath);
      markLoaded(targetPath, text);
    },
    [markLoaded, text],
  );

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
          void switchToPath(filePath);
        }
      })
      .then((stop) => {
        unlisten = stop;
      });

    return () => {
      unlisten?.();
    };
  }, [switchToPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        void newDocument();
      } else if (key === "o") {
        event.preventDefault();
        void openFile();
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void saveFileAs();
      } else if (key === "s") {
        event.preventDefault();
        void flush();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flush, newDocument, openFile, saveFileAs]);

  return (
    <div className="app">
      <header className="titlebar">
        <div
          className="titlebar-drag"
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
        />
        <button
          type="button"
          className={`titlebar-new${newDocPulse ? " titlebar-new-pulse" : ""}`}
          title="New document"
          aria-label="New document"
          onClick={() => {
            void newDocument();
          }}
        >
          <PlusIcon className="titlebar-new-icon" />
        </button>
      </header>
      <div className={`editor-shell${newDocPulse ? " editor-shell-pulse" : ""}`}>
        <textarea
          ref={editorRef}
          className="editor"
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          wrap={wrap === "wrap" ? "soft" : "off"}
          disabled={!ready}
        />
      </div>
      <footer className="statusbar">
        <div className="statusbar-left">
          {path && (
            <button
              type="button"
              className={`statusbar-doc${newDocPulse ? " statusbar-doc-pulse" : ""}`}
              title="Documents"
              aria-label="Documents. Click to browse."
              onClick={() => setPickerOpen(true)}
            >
              <span className="statusbar-doc-name">
                {documentLabel(path, text)}
              </span>
              <span className="statusbar-doc-chevron" aria-hidden="true">
                ▾
              </span>
            </button>
          )}
          {saveError && (
            <span className="statusbar-flag statusbar-flag-error">
              Save failed
            </span>
          )}
        </div>
        <div className="statusbar-controls">
          <button
            type="button"
            className="statusbar-toggle"
            title={`Font size (${fontSizePixels}px)`}
            aria-label={`Font size, ${fontSizePixels}px. Click to change.`}
            onClick={cycleFontSize}
          >
            <FontSizeIcon className="statusbar-toggle-icon" />
            <span className="statusbar-toggle-value">{fontSizePixels}</span>
          </button>
          <button
            type="button"
            className="statusbar-toggle"
            title={WRAP_LABELS[wrap]}
            aria-label={`Line wrap, ${WRAP_LABELS[wrap]}. Click to toggle.`}
            onClick={toggleLineWrap}
          >
            {wrap === "wrap" ? (
              <WrapOnIcon className="statusbar-toggle-icon" />
            ) : (
              <WrapOffIcon className="statusbar-toggle-icon" />
            )}
          </button>
          <button
            type="button"
            className="statusbar-toggle"
            title={MAX_WIDTH_LABELS[maxWidth]}
            aria-label={`Content width, ${MAX_WIDTH_LABELS[maxWidth]}. Click to toggle.`}
            onClick={toggleContentWidth}
          >
            {maxWidth === "full" ? (
              <FullWidthIcon className="statusbar-toggle-icon" />
            ) : (
              <NarrowWidthIcon className="statusbar-toggle-icon" />
            )}
          </button>
          <button
            type="button"
            className="statusbar-toggle"
            title={THEME_LABELS[theme]}
            aria-label={`Appearance, ${THEME_LABELS[theme]}. Click to change.`}
            onClick={cycleTheme}
          >
            {theme === "light" ? (
              <ThemeLightIcon className="statusbar-toggle-icon" />
            ) : theme === "dark" ? (
              <ThemeDarkIcon className="statusbar-toggle-icon" />
            ) : (
              <ThemeSystemIcon className="statusbar-toggle-icon" />
            )}
          </button>
        </div>
      </footer>
      {pickerOpen && (
        <DocumentPicker
          currentPath={path}
          onClose={() => setPickerOpen(false)}
          onSelect={(filePath) => {
            void switchToPath(filePath);
          }}
        />
      )}
    </div>
  );
}

export default App;
