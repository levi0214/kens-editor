import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentPicker } from "./DocumentPicker";
import { ImageTray } from "./ImageTray";
import { flipDirection } from "./documentNav";
import {
  FontSizeIcon,
  FullWidthIcon,
  ImagesIcon,
  NarrowWidthIcon,
  PlusIcon,
  UnmarkdownIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
  ThemeSystemIcon,
  WrapOffIcon,
  WrapOnIcon,
} from "./statusBarIcons";
import { listDocumentImages } from "./images";
import {
  applyFontSize,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_PRESETS,
  nextFontSize,
  prevFontSize,
  rotateFontSize,
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
import { useFlushOnClose } from "./useFlushOnClose";
import { useChromeIdle } from "./useChromeIdle";
import { useDocumentSwitch } from "./useDocumentSwitch";
import { useWindowFullscreen } from "./useWindowFullscreen";
import { mostRecentVaultDocument } from "./vault";
import {
  createPristineDraft,
  discardPristineDraft,
  forgetDraft,
} from "./sessionDrafts";
import { documentLabel, windowTitle } from "./windowTitle";
import { ChromeHint } from "./keyHint";
import { completeOnboarding, initialOnboardingStatus, resolveOnboardingStatus } from "./onboarding";
import { WelcomeScreen } from "./WelcomeScreen";
import { UnmarkdownConfirm } from "./UnmarkdownConfirm";
import { useUnmarkdown } from "./useUnmarkdown";
import { indentSelectedLines, outdentSelectedLines } from "./indent";
import "./App.css";

const NEW_DOC_PULSE_MS = 180;
const HINT_DELAY_MS = 250;

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

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pulseTimerRef = useRef<number | undefined>(undefined);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const menuActionsRef = useRef({
    newDocument: () => {},
    openFile: () => {},
    saveFile: () => {},
    saveFileAs: () => {},
    togglePicker: () => {},
    unmarkdown: () => {},
  });
  const [text, setText] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState(initialOnboardingStatus);
  const showWelcome = onboardingStatus === "welcome";
  const onboardingComplete = onboardingStatus === "complete";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageTrayOpen, setImageTrayOpen] = useState(false);
  const [imagesSupported, setImagesSupported] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [newDocPulse, setNewDocPulse] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(storedFontSize);
  const [wrap, setWrap] = useState<WrapMode>(storedWrap);
  const [maxWidth, setMaxWidth] = useState<MaxWidthMode>(storedMaxWidth);
  const [theme, setTheme] = useState<ThemeMode>(storedTheme);
  const [chromeHovered, setChromeHovered] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const { flush, markLoaded, saveError } = useAutoSave(text, path);
  useFlushOnClose(flush);
  const { visible: chromeVisible, bump: bumpChrome } = useChromeIdle(
    !pickerOpen && !imageTrayOpen && !saveError && !showWelcome,
    chromeHovered,
  );
  useWindowFullscreen();

  const showHint = useCallback((name: string) => {
    if (hintTimerRef.current !== undefined) {
      window.clearTimeout(hintTimerRef.current);
    }

    hintTimerRef.current = window.setTimeout(() => {
      setActiveHint(name);
      hintTimerRef.current = undefined;
    }, HINT_DELAY_MS);
  }, []);

  const hideHint = useCallback(() => {
    if (hintTimerRef.current !== undefined) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = undefined;
    }
    setActiveHint(null);
  }, []);

  const commitFontSize = useCallback((pick: (current: FontSize) => FontSize) => {
    hideHint();
    setFontSize((current) => {
      const next = pick(current);
      applyFontSize(next);
      return next;
    });
  }, [hideHint]);

  const cycleFontSize = useCallback(() => {
    commitFontSize(rotateFontSize);
  }, [commitFontSize]);

  const increaseFontSize = useCallback(() => {
    commitFontSize(nextFontSize);
  }, [commitFontSize]);

  const decreaseFontSize = useCallback(() => {
    commitFontSize(prevFontSize);
  }, [commitFontSize]);

  const resetFontSize = useCallback(() => {
    hideHint();
    applyFontSize(DEFAULT_FONT_SIZE);
    setFontSize(DEFAULT_FONT_SIZE);
  }, [hideHint]);

  const toggleLineWrap = useCallback(() => {
    hideHint();
    setWrap((current) => {
      const next = toggleWrap(current);
      applyWrap(next);
      return next;
    });
  }, [hideHint]);

  const toggleContentWidth = useCallback(() => {
    hideHint();
    setMaxWidth((current) => {
      const next = toggleMaxWidth(current);
      applyMaxWidth(next);
      return next;
    });
  }, [hideHint]);

  const cycleTheme = useCallback(() => {
    hideHint();
    setTheme((current) => {
      const next = nextTheme(current);
      void applyTheme(next);
      return next;
    });
  }, [hideHint]);

  const fontSizePixels = FONT_SIZE_PRESETS[fontSize];

  useEffect(() => {
    if (onboardingStatus !== "pending") {
      return;
    }

    let active = true;

    void resolveOnboardingStatus().then((status) => {
      if (active) {
        setOnboardingStatus(status);
      }
    });

    return () => {
      active = false;
    };
  }, [onboardingStatus]);

  useEffect(() => {
    if (ready && onboardingComplete) {
      focusEditor(editorRef.current);
    }
  }, [ready, onboardingComplete]);

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
    if (path === null) {
      return;
    }

    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.scrollTop = 0;
      editor.setSelectionRange(0, 0);
    });
  }, [path]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== undefined) {
        window.clearTimeout(pulseTimerRef.current);
      }
      if (hintTimerRef.current !== undefined) {
        window.clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  const openPicker = useCallback(() => {
    hideHint();
    setImageTrayOpen(false);
    setPickerOpen(true);
  }, [hideHint]);

  const openImageTray = useCallback(() => {
    hideHint();
    setPickerOpen(false);
    setImageTrayOpen(true);
  }, [hideHint]);

  const handleImageCountChange = useCallback(
    (count: number) => {
      setImageCount(count);
      if (count > 0 && path) {
        forgetDraft(path);
      }
    },
    [path],
  );

  const { flipDocument, loadFromPath, switchToPath, listPath } = useDocumentSwitch({
    path,
    text,
    setPath,
    setText,
    flush,
    markLoaded,
  });

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

  const newDocument = useCallback(async () => {
    if (!onboardingComplete) {
      return;
    }

    if (text.length === 0 && imageCount === 0) {
      pulseNewDocument();
      focusEditor(editorRef.current);
      return;
    }

    await flush();
    await discardPristineDraft(path, text);
    const filePath = await createPristineDraft();
    setPath(filePath);
    setText("");
    markLoaded(filePath, "");
    pulseNewDocument();
    focusEditor(editorRef.current);
  }, [flush, imageCount, markLoaded, onboardingComplete, path, pulseNewDocument, text]);

  useEffect(() => {
    let active = true;
    setImageTrayOpen(false);
    setImagesSupported(false);
    setImageCount(0);

    if (path === null) {
      return () => {
        active = false;
      };
    }

    void listDocumentImages(path)
      .then((images) => {
        if (active) {
          setImagesSupported(true);
          setImageCount(images.length);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    if (!onboardingComplete) {
      return;
    }

    let active = true;

    void (async () => {
      const recent = await mostRecentVaultDocument();
      let filePath = recent;

      if (filePath === null) {
        filePath = await createPristineDraft();
      }

      if (!active) {
        return;
      }

      await loadFromPath(filePath);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, [loadFromPath, onboardingComplete]);

  const handleStart = useCallback(() => {
    completeOnboarding();
    setOnboardingStatus("complete");
  }, []);

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

  const handleDocumentDeleted = useCallback(
    async (deletedPath: string) => {
      forgetDraft(deletedPath);

      if (deletedPath !== path) {
        return;
      }

      const nextPath = await mostRecentVaultDocument();

      if (nextPath) {
        await loadFromPath(nextPath);
        return;
      }

      const filePath = await createPristineDraft();
      setPath(filePath);
      setText("");
      markLoaded(filePath, "");
    },
    [loadFromPath, markLoaded, path],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") {
          return;
        }

        if (imageTrayOpen) {
          return;
        }

        const filePath = event.payload.paths[0];
        if (filePath) {
          void switchToPath(filePath);
        }
      })
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [imageTrayOpen, switchToPath]);

  const togglePicker = useCallback(() => {
    hideHint();
    setImageTrayOpen(false);
    setPickerOpen((open) => {
      if (open) {
        focusEditor(editorRef.current);
      }
      return !open;
    });
  }, [hideHint]);

  const {
    confirmOpen: unmarkdownConfirmOpen,
    openConfirm: openUnmarkdownConfirm,
    confirm: confirmUnmarkdown,
    cancel: cancelUnmarkdownConfirm,
  } = useUnmarkdown({
    editorRef,
    text,
    setText,
    path,
    ready,
    onboardingComplete,
    hideHint,
    focusEditor,
  });

  useEffect(() => {
    menuActionsRef.current = {
      newDocument: () => {
        void newDocument();
      },
      openFile: () => {
        void openFile();
      },
      saveFile: () => {
        void flush();
      },
      saveFileAs: () => {
        void saveFileAs();
      },
      togglePicker,
      unmarkdown: openUnmarkdownConfirm,
    };
  }, [flush, newDocument, openFile, openUnmarkdownConfirm, saveFileAs, togglePicker]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let mounted = true;

    void (async () => {
      const { Menu, MenuItem, PredefinedMenuItem, Submenu } = await import(
        "@tauri-apps/api/menu"
      );

      const separator = () => PredefinedMenuItem.new({ item: "Separator" });

      const appMenu = await Submenu.new({
        text: "Ken's Editor",
        items: [
          await PredefinedMenuItem.new({ item: { About: null } }),
          await separator(),
          await PredefinedMenuItem.new({ item: "Services" }),
          await separator(),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await separator(),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ],
      });

      const fileMenu = await Submenu.new({
        text: "File",
        items: [
          await MenuItem.new({
            id: "new-document",
            text: "New Document",
            accelerator: "CmdOrCtrl+N",
            action: () => menuActionsRef.current.newDocument(),
          }),
          await MenuItem.new({
            id: "documents",
            text: "Documents",
            accelerator: "CmdOrCtrl+P",
            action: () => menuActionsRef.current.togglePicker(),
          }),
          await separator(),
          await MenuItem.new({
            id: "open-file",
            text: "Open...",
            accelerator: "CmdOrCtrl+O",
            action: () => menuActionsRef.current.openFile(),
          }),
          await separator(),
          await MenuItem.new({
            id: "save-file",
            text: "Save",
            accelerator: "CmdOrCtrl+S",
            action: () => menuActionsRef.current.saveFile(),
          }),
          await MenuItem.new({
            id: "save-file-as",
            text: "Save As...",
            accelerator: "CmdOrCtrl+Shift+S",
            action: () => menuActionsRef.current.saveFileAs(),
          }),
          await separator(),
          await PredefinedMenuItem.new({ item: "CloseWindow" }),
        ],
      });

      const editMenu = await Submenu.new({
        text: "Edit",
        items: [
          await PredefinedMenuItem.new({ item: "Undo" }),
          await PredefinedMenuItem.new({ item: "Redo" }),
          await separator(),
          await PredefinedMenuItem.new({ item: "Cut" }),
          await PredefinedMenuItem.new({ item: "Copy" }),
          await PredefinedMenuItem.new({ item: "Paste" }),
          await PredefinedMenuItem.new({ item: "SelectAll" }),
          await separator(),
          await MenuItem.new({
            id: "unmarkdown",
            text: "Unmarkdown",
            accelerator: "CmdOrCtrl+Shift+R",
            action: () => menuActionsRef.current.unmarkdown(),
          }),
        ],
      });

      const viewMenu = await Submenu.new({
        text: "View",
        items: [await PredefinedMenuItem.new({ item: "Fullscreen" })],
      });

      const windowMenu = await Submenu.new({
        text: "Window",
        items: [
          await PredefinedMenuItem.new({ item: "Minimize" }),
          await PredefinedMenuItem.new({ item: "Maximize" }),
          await separator(),
          await PredefinedMenuItem.new({ item: "BringAllToFront" }),
        ],
      });

      const menu = await Menu.new({
        items: [appMenu, fileMenu, editMenu, viewMenu, windowMenu],
      });
      if (mounted) {
        await menu.setAsAppMenu();
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showWelcome) {
        return;
      }

      const key = event.key.toLowerCase();
      const direction = flipDirection(event);

      if (
        direction !== null &&
        !pickerOpen &&
        !imageTrayOpen &&
        !unmarkdownConfirmOpen &&
        onboardingComplete &&
        ready
      ) {
        event.preventDefault();
        void flipDocument(direction).then((flipped) => {
          if (flipped) {
            bumpChrome();
          }
        });
        return;
      }

      if (!event.metaKey) {
        return;
      }

      const menuOwned = key === "n" || key === "o" || key === "p" || key === "s";
      if (isTauri() && menuOwned) {
        return;
      }

      if (key === "n") {
        event.preventDefault();
        void newDocument();
      } else if (key === "o") {
        event.preventDefault();
        void openFile();
      } else if (key === "p") {
        event.preventDefault();
        togglePicker();
      } else if (key === "s" && event.shiftKey) {
        event.preventDefault();
        void saveFileAs();
      } else if (key === "s") {
        event.preventDefault();
        void flush();
      } else if (key === "-" || key === "_") {
        event.preventDefault();
        decreaseFontSize();
      } else if (key === "=" || key === "+") {
        event.preventDefault();
        increaseFontSize();
      } else if (key === "0") {
        event.preventDefault();
        resetFontSize();
      } else if (key === "l" && event.shiftKey) {
        event.preventDefault();
        toggleLineWrap();
      } else if (key === "m" && event.shiftKey) {
        event.preventDefault();
        toggleContentWidth();
      } else if (key === "t" && event.shiftKey) {
        event.preventDefault();
        cycleTheme();
      } else if (key === "r" && event.shiftKey) {
        event.preventDefault();
        openUnmarkdownConfirm();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    bumpChrome,
    decreaseFontSize,
    flipDocument,
    flush,
    increaseFontSize,
    imageTrayOpen,
    onboardingComplete,
    openUnmarkdownConfirm,
    newDocument,
    openFile,
    pickerOpen,
    ready,
    resetFontSize,
    saveFileAs,
    togglePicker,
    toggleLineWrap,
    toggleContentWidth,
    cycleTheme,
    showWelcome,
    unmarkdownConfirmOpen,
  ]);

  return (
    <div className={`app${newDocPulse ? " app-new-pulse" : ""}`}>
      <header
        className="titlebar"
        onMouseEnter={() => setChromeHovered(true)}
        onMouseLeave={() => setChromeHovered(false)}
      >
        <div
          className="titlebar-drag"
          data-tauri-drag-region
          onMouseDown={startWindowDrag}
        />
        {!showWelcome && (
          <span
            className={`chrome-tip-wrap titlebar-new-wrap${chromeVisible ? "" : " titlebar-new-wrap-hidden"}`}
            onMouseEnter={() => showHint("new")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("new")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="New"
              keys={["⌘", "N"]}
              className="chrome-tip-below chrome-tip-right"
              visible={activeHint === "new"}
            />
            <button
              type="button"
              className="titlebar-new"
              aria-label="New document. ⌘N."
              onClick={() => {
                hideHint();
                void newDocument();
              }}
            >
              <PlusIcon className="titlebar-new-icon" />
            </button>
          </span>
        )}
      </header>
      <div className="editor-shell">
        {showWelcome ? (
          <WelcomeScreen onStart={handleStart} />
        ) : (
          <textarea
            ref={editorRef}
            className="editor"
            value={text}
            onChange={(event) => {
              const next = event.target.value;
              setText(next);
              if (next.length > 0 && path) {
                forgetDraft(path);
              }
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") {
                return;
              }
              event.preventDefault();
              const editor = event.currentTarget;
              const start = editor.selectionStart;
              const end = editor.selectionEnd;
              const direction = editor.selectionDirection;

              if (event.shiftKey) {
                const edit = outdentSelectedLines(editor.value, start, end);
                if (edit === null) {
                  return;
                }
                editor.setRangeText(
                  edit.replacement,
                  edit.rangeStart,
                  edit.rangeEnd,
                );
                editor.setSelectionRange(
                  edit.selectionStart,
                  edit.selectionEnd,
                  direction,
                );
              } else if (editor.value.slice(start, end).includes("\n")) {
                const edit = indentSelectedLines(editor.value, start, end);
                editor.setRangeText(
                  edit.replacement,
                  edit.rangeStart,
                  edit.rangeEnd,
                );
                editor.setSelectionRange(
                  edit.selectionStart,
                  edit.selectionEnd,
                  direction,
                );
              } else {
                editor.setRangeText("  ", start, end, "end");
              }

              const next = editor.value;
              setText(next);
              if (next.length > 0 && path) {
                forgetDraft(path);
              }
            }}
            spellCheck={false}
            wrap={wrap === "wrap" ? "soft" : "off"}
            disabled={!ready}
          />
        )}
      </div>
      {!showWelcome && (
        <footer
          className={`statusbar${chromeVisible ? "" : " statusbar-hidden"}`}
          onMouseEnter={() => setChromeHovered(true)}
          onMouseLeave={() => setChromeHovered(false)}
        >
        <div className="statusbar-left">
          {path && (
            <div className="statusbar-doc-actions">
              <span
                className="chrome-tip-wrap statusbar-doc-wrap"
                onMouseEnter={() => showHint("documents")}
                onMouseLeave={hideHint}
                onFocus={() => showHint("documents")}
                onBlur={hideHint}
              >
                <ChromeHint
                  groups={[
                    { label: "List", keys: ["⌘", "P"] },
                    { label: "Prev", keys: ["⌘", "K"] },
                    { label: "Next", keys: ["⌘", "J"] },
                  ]}
                  className="chrome-tip-left"
                  visible={activeHint === "documents"}
                />
                <button
                  type="button"
                  className="statusbar-doc"
                  aria-label="Documents. ⌘P to browse. ⌘J and ⌘K to flip."
                  onClick={openPicker}
                >
                  <span className="statusbar-doc-name">
                    {documentLabel(path, text)}
                  </span>
                  <span className="statusbar-doc-chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
              </span>
              {imagesSupported && (
                <span
                  className="chrome-tip-wrap"
                  onMouseEnter={() => showHint("images")}
                  onMouseLeave={hideHint}
                  onFocus={() => showHint("images")}
                  onBlur={hideHint}
                >
                  <ChromeHint
                    name="Images"
                    className="chrome-tip-left"
                    visible={activeHint === "images"}
                  />
                  <button
                    type="button"
                    className="statusbar-toggle"
                    aria-label={`Images, ${imageCount}.`}
                    onClick={openImageTray}
                  >
                    <ImagesIcon className="statusbar-toggle-icon" />
                    {imageCount > 0 && (
                      <span className="statusbar-toggle-value">{imageCount}</span>
                    )}
                  </button>
                </span>
              )}
              <span
                className="chrome-tip-wrap"
                onMouseEnter={() => showHint("unmarkdown")}
                onMouseLeave={hideHint}
                onFocus={() => showHint("unmarkdown")}
                onBlur={hideHint}
              >
                <ChromeHint
                  name="Unmarkdown"
                  keys={["⇧", "⌘", "R"]}
                  className="chrome-tip-left"
                  visible={activeHint === "unmarkdown"}
                />
                <button
                  type="button"
                  className="statusbar-toggle"
                  aria-label="Unmarkdown. ⌘⇧R."
                  onClick={openUnmarkdownConfirm}
                >
                  <UnmarkdownIcon className="statusbar-toggle-icon" />
                </button>
              </span>
            </div>
          )}
          {saveError && (
            <span className="statusbar-flag statusbar-flag-error">
              Save failed
            </span>
          )}
        </div>
        <div className="statusbar-controls">
          <span
            className="chrome-tip-wrap"
            onMouseEnter={() => showHint("font")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("font")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="Size"
              keys={["⌘", "+", "−"]}
              className="chrome-tip-right"
              visible={activeHint === "font"}
            />
            <button
              type="button"
              className="statusbar-toggle"
              aria-label={`Font size, ${fontSizePixels}px. ⌘- smaller, ⌘= larger, ⌘0 default.`}
              onClick={cycleFontSize}
            >
              <FontSizeIcon className="statusbar-toggle-icon" />
              <span className="statusbar-toggle-value">{fontSizePixels}</span>
            </button>
          </span>
          <span
            className="chrome-tip-wrap"
            onMouseEnter={() => showHint("wrap")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("wrap")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="Wrap"
              keys={["⇧", "⌘", "L"]}
              className="chrome-tip-right"
              visible={activeHint === "wrap"}
            />
            <button
              type="button"
              className="statusbar-toggle"
              aria-label={`Line wrap, ${WRAP_LABELS[wrap]}. ⌘⇧L to toggle.`}
              onClick={toggleLineWrap}
            >
              {wrap === "wrap" ? (
                <WrapOnIcon className="statusbar-toggle-icon" />
              ) : (
                <WrapOffIcon className="statusbar-toggle-icon" />
              )}
            </button>
          </span>
          <span
            className="chrome-tip-wrap"
            onMouseEnter={() => showHint("width")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("width")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="Width"
              keys={["⇧", "⌘", "M"]}
              className="chrome-tip-right"
              visible={activeHint === "width"}
            />
            <button
              type="button"
              className="statusbar-toggle"
              aria-label={`Content width, ${MAX_WIDTH_LABELS[maxWidth]}. ⌘⇧M to toggle.`}
              onClick={toggleContentWidth}
            >
              {maxWidth === "full" ? (
                <FullWidthIcon className="statusbar-toggle-icon" />
              ) : (
                <NarrowWidthIcon className="statusbar-toggle-icon" />
              )}
            </button>
          </span>
          <span
            className="chrome-tip-wrap"
            onMouseEnter={() => showHint("theme")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("theme")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="Theme"
              keys={["⇧", "⌘", "T"]}
              className="chrome-tip-right"
              visible={activeHint === "theme"}
            />
            <button
              type="button"
              className="statusbar-toggle"
              aria-label={`Appearance, ${THEME_LABELS[theme]}. ⌘⇧T to cycle.`}
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
          </span>
        </div>
        </footer>
      )}
      {unmarkdownConfirmOpen && (
        <UnmarkdownConfirm
          onConfirm={confirmUnmarkdown}
          onCancel={cancelUnmarkdownConfirm}
        />
      )}
      {pickerOpen && onboardingComplete && (
        <DocumentPicker
          currentPath={path}
          listPath={listPath}
          currentText={text}
          onClose={() => {
            setPickerOpen(false);
            focusEditor(editorRef.current);
          }}
          onDelete={(filePath) => {
            void handleDocumentDeleted(filePath);
          }}
          onSwitch={(filePath) => {
            void switchToPath(filePath);
          }}
        />
      )}
      {imageTrayOpen && path && imagesSupported && onboardingComplete && (
        <ImageTray
          documentPath={path}
          onClose={() => {
            setImageTrayOpen(false);
            focusEditor(editorRef.current);
          }}
          onCountChange={handleImageCountChange}
        />
      )}
    </div>
  );
}

export default App;
