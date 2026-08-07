import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  VersionsIcon,
  WrapOffIcon,
  WrapOnIcon,
} from "./statusBarIcons";
import {
  addDocumentImageFiles,
  addDocumentImages,
  clipboardImageFiles,
  isImagePath,
  listDocumentImages,
} from "./images";
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
import { VersionHistory } from "./VersionHistory";
import { VersionDiff } from "./VersionDiff";
import {
  createDocumentVersionReader,
  deleteDocumentVersion,
  listDocumentVersions,
  saveDocumentVersion,
  type DocumentVersion,
  type DocumentVersionReader,
  type SaveVersionResult,
} from "./versions";
import { useVersionSidebarWindow } from "./useVersionSidebarWindow";
import "./App.css";

const NEW_DOC_PULSE_MS = 180;
const HINT_DELAY_MS = 250;
const IMAGE_FEEDBACK_MS = 1400;
const NOT_A_VAULT_DOCUMENT_ERROR = "Not a vault document";

type VersionCatalogState =
  | {
      documentPath: string;
      status: "ready";
      versions: DocumentVersion[];
    }
  | {
      documentPath: string;
      status: "error";
      message: string;
    }
  | {
      documentPath: string;
      status: "unsupported";
    };

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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function App() {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pulseTimerRef = useRef<number | undefined>(undefined);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const imageFeedbackTimerRef = useRef<number | undefined>(undefined);
  const menuActionsRef = useRef({
    newDocument: () => {},
    openFile: () => {},
    saveFile: () => {},
    saveFileAs: () => {},
    togglePicker: () => {},
    toggleImages: () => {},
    toggleVersions: () => {},
    saveVersion: () => {},
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
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionCatalog, setVersionCatalog] =
    useState<VersionCatalogState | null>(null);
  const [versionCatalogAttempt, setVersionCatalogAttempt] = useState(0);
  const [versionReadAttempt, setVersionReadAttempt] = useState(0);
  const currentVersionCatalog =
    versionCatalog?.documentPath === path ? versionCatalog : null;
  const versionsSupported = currentVersionCatalog?.status === "ready";
  const versionsAvailable =
    currentVersionCatalog?.status === "ready" ||
    currentVersionCatalog?.status === "error";
  const versions =
    currentVersionCatalog?.status === "ready"
      ? currentVersionCatalog.versions
      : [];
  const versionCatalogError =
    currentVersionCatalog?.status === "error"
      ? currentVersionCatalog.message
      : null;
  const [versionSaving, setVersionSaving] = useState(false);
  const [versionSaveError, setVersionSaveError] = useState<string | null>(null);
  const versionSavingRef = useRef(false);
  const pendingVersionSaveRef = useRef<{
    documentPath: string;
    contents: string;
    reader: DocumentVersionReader;
  } | null>(null);
  const currentPathRef = useRef(path);
  currentPathRef.current = path;
  const versionReader = useMemo(
    () => (path ? createDocumentVersionReader(path) : null),
    [path],
  );
  const [diffSelection, setDiffSelection] = useState<{
    version: DocumentVersion;
    previousVersion: DocumentVersion | null;
  } | null>(null);
  const [imagesSupported, setImagesSupported] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [imageDragging, setImageDragging] = useState(false);
  const [imageFeedback, setImageFeedback] = useState<string | null>(null);
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
  useVersionSidebarWindow(versionsOpen);

  useEffect(() => {
    if (!versionsOpen) {
      setDiffSelection(null);
    }
  }, [versionsOpen]);

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

  const closeVersionDiff = useCallback(() => {
    setDiffSelection(null);
    requestAnimationFrame(() => focusEditor(editorRef.current));
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
      if (imageFeedbackTimerRef.current !== undefined) {
        window.clearTimeout(imageFeedbackTimerRef.current);
      }
    };
  }, []);

  const showImageFeedback = useCallback(
    (message: string) => {
      if (imageFeedbackTimerRef.current !== undefined) {
        window.clearTimeout(imageFeedbackTimerRef.current);
      }
      setImageFeedback(message);
      bumpChrome();
      imageFeedbackTimerRef.current = window.setTimeout(() => {
        setImageFeedback(null);
        imageFeedbackTimerRef.current = undefined;
      }, IMAGE_FEEDBACK_MS);
    },
    [bumpChrome],
  );

  const openPicker = useCallback(() => {
    hideHint();
    setImageTrayOpen(false);
    setVersionsOpen(false);
    setPickerOpen(true);
  }, [hideHint]);

  const toggleImageTray = useCallback(() => {
    if (!imagesSupported) {
      return;
    }

    hideHint();
    setPickerOpen(false);
    setVersionsOpen(false);
    setImageTrayOpen((open) => {
      if (open) {
        focusEditor(editorRef.current);
      }
      return !open;
    });
  }, [hideHint, imagesSupported]);

  const retryVersionCatalog = useCallback(() => {
    setVersionCatalogAttempt((attempt) => attempt + 1);
  }, []);

  const retryVersionReads = useCallback(() => {
    setVersionReadAttempt((attempt) => attempt + 1);
  }, []);

  const toggleVersions = useCallback(() => {
    if (!versionsAvailable) {
      return;
    }

    hideHint();
    setPickerOpen(false);
    setImageTrayOpen(false);
    if (versionsOpen) {
      setVersionsOpen(false);
      closeVersionDiff();
    } else {
      setVersionsOpen(true);
    }
  }, [closeVersionDiff, hideHint, versionsAvailable, versionsOpen]);

  const saveCurrentVersion = useCallback(async (): Promise<SaveVersionResult | null> => {
    if (
      !versionsSupported ||
      !versionReader ||
      !path ||
      !ready ||
      !onboardingComplete
    ) {
      return null;
    }

    const requested = {
      documentPath: path,
      contents: text,
      reader: versionReader,
    };
    if (versionSavingRef.current) {
      pendingVersionSaveRef.current = requested;
      return null;
    }

    versionSavingRef.current = true;
    setVersionSaving(true);
    let request: typeof requested | null = requested;
    let latestResult: SaveVersionResult | null = null;
    let latestError: unknown = null;

    try {
      while (request) {
        const saveRequest = request;
        pendingVersionSaveRef.current = null;
        setVersionSaveError(null);

        try {
          await flush();
          const result = await saveDocumentVersion(
            saveRequest.documentPath,
            saveRequest.contents,
          );
          saveRequest.reader.remember(result.version.id, saveRequest.contents);

          if (currentPathRef.current === saveRequest.documentPath) {
            setVersionCatalog((current) =>
              current?.documentPath === saveRequest.documentPath &&
              current.status === "ready"
                ? {
                    documentPath: saveRequest.documentPath,
                    status: "ready",
                    versions: [
                      result.version,
                      ...current.versions.filter(
                        (version) => version.id !== result.version.id,
                      ),
                    ],
                  }
                : current,
            );
          }
          latestResult = result;
          latestError = null;
        } catch (error) {
          latestError = error;
          if (currentPathRef.current === saveRequest.documentPath) {
            setVersionSaveError(errorText(error));
          }
        }

        request = pendingVersionSaveRef.current;
      }

      if (latestError) {
        throw latestError;
      }
      return latestResult;
    } finally {
      versionSavingRef.current = false;
      setVersionSaving(false);
    }
  }, [flush, onboardingComplete, path, ready, text, versionReader, versionsSupported]);

  const requestSaveVersion = useCallback(() => {
    hideHint();
    void saveCurrentVersion().catch(() => undefined);
  }, [hideHint, saveCurrentVersion]);

  const deleteVersion = useCallback(
    async (versionId: string) => {
      if (!versionsSupported || !path) {
        return;
      }

      const documentPath = path;
      const catalog = versionCatalog;
      if (
        !catalog ||
        catalog.documentPath !== documentPath ||
        catalog.status !== "ready"
      ) {
        return;
      }
      const remaining = catalog.versions.filter(
        (version) => version.id !== versionId,
      );
      const renumbered = remaining.map((version, index) => ({
        ...version,
        number: remaining.length - index,
      }));

      await deleteDocumentVersion(documentPath, versionId);
      if (currentPathRef.current !== documentPath) {
        return;
      }

      setVersionCatalog({ documentPath, status: "ready", versions: renumbered });
      setDiffSelection((current) => {
        if (!current) {
          return null;
        }

        const selectedIndex = renumbered.findIndex(
          (version) => version.id === current.version.id,
        );
        return selectedIndex < 0
          ? null
          : {
              version: renumbered[selectedIndex],
              previousVersion: renumbered[selectedIndex + 1] ?? null,
            };
      });
    },
    [path, versionCatalog, versionsSupported],
  );

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
    setVersionsOpen(false);
    setImagesSupported(false);
    setVersionCatalog(null);
    setImageCount(0);
    setVersionSaveError(null);

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
    if (path === null) {
      return;
    }

    let active = true;
    void listDocumentVersions(path)
      .then((loadedVersions) => {
        if (active) {
          setVersionCatalog({
            documentPath: path,
            status: "ready",
            versions: loadedVersions,
          });
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        const message = errorText(error);
        setVersionCatalog(
          message === NOT_A_VAULT_DOCUMENT_ERROR
            ? { documentPath: path, status: "unsupported" }
            : { documentPath: path, status: "error", message },
        );
      });

    return () => {
      active = false;
    };
  }, [path, versionCatalogAttempt]);

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
        if (imageTrayOpen) {
          setImageDragging(false);
          return;
        }

        if (event.payload.type === "enter") {
          setImageDragging(
            imagesSupported && event.payload.paths.some(isImagePath),
          );
          return;
        }
        if (event.payload.type === "leave") {
          setImageDragging(false);
          return;
        }
        if (event.payload.type !== "drop") {
          return;
        }

        setImageDragging(false);
        const imagePaths = event.payload.paths.filter(isImagePath);
        if (imagePaths.length > 0) {
          if (!imagesSupported || !path) {
            showImageFeedback("Images unavailable for this file");
            return;
          }

          void addDocumentImages(path, imagePaths)
            .then((images) => {
              setImageCount(images.length);
              forgetDraft(path);
              showImageFeedback(
                imagePaths.length === 1
                  ? "Image added"
                  : `${imagePaths.length} images added`,
              );
            })
            .catch(() => showImageFeedback("Could not add image"));
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
  }, [
    imageTrayOpen,
    imagesSupported,
    path,
    showImageFeedback,
    switchToPath,
  ]);

  useEffect(() => {
    if (imageTrayOpen) {
      return;
    }

    const editor = editorRef.current;
    const onPaste = (event: ClipboardEvent) => {
      if (event.target !== editor) {
        return;
      }

      const files = clipboardImageFiles(event.clipboardData);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      if (!imagesSupported || !path) {
        showImageFeedback("Images unavailable for this file");
        return;
      }

      void addDocumentImageFiles(path, files)
        .then((images) => {
          setImageCount(images.length);
          forgetDraft(path);
          showImageFeedback(
            files.length === 1
              ? "Image added"
              : `${files.length} images added`,
          );
        })
        .catch(() => showImageFeedback("Could not add image"));
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [imageTrayOpen, imagesSupported, path, showImageFeedback]);

  const togglePicker = useCallback(() => {
    hideHint();
    setImageTrayOpen(false);
    setVersionsOpen(false);
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
      toggleImages: toggleImageTray,
      toggleVersions,
      saveVersion: requestSaveVersion,
      unmarkdown: openUnmarkdownConfirm,
    };
  }, [
    flush,
    newDocument,
    openFile,
    openUnmarkdownConfirm,
    requestSaveVersion,
    saveFileAs,
    toggleImageTray,
    togglePicker,
    toggleVersions,
  ]);

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
          await MenuItem.new({
            id: "images",
            text: "Images",
            accelerator: "CmdOrCtrl+I",
            action: () => menuActionsRef.current.toggleImages(),
          }),
          await MenuItem.new({
            id: "versions",
            text: "Versions",
            accelerator: "CmdOrCtrl+Alt+V",
            action: () => menuActionsRef.current.toggleVersions(),
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
          await MenuItem.new({
            id: "save-version",
            text: "Save Current Version",
            accelerator: "CmdOrCtrl+Alt+S",
            action: () => menuActionsRef.current.saveVersion(),
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
      if (event.key === "Escape" && versionsOpen) {
        event.preventDefault();
        if (diffSelection) {
          closeVersionDiff();
        } else {
          setVersionsOpen(false);
          focusEditor(editorRef.current);
        }
        return;
      }

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

      const menuOwned =
        key === "i" ||
        key === "n" ||
        key === "o" ||
        key === "p" ||
        key === "s" ||
        (key === "v" && event.altKey);
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
      } else if (key === "i") {
        event.preventDefault();
        toggleImageTray();
      } else if (key === "v" && event.altKey && !event.shiftKey) {
        event.preventDefault();
        toggleVersions();
      } else if (key === "s" && event.altKey && !event.shiftKey) {
        event.preventDefault();
        requestSaveVersion();
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
    closeVersionDiff,
    decreaseFontSize,
    diffSelection,
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
    requestSaveVersion,
    resetFontSize,
    saveFileAs,
    toggleImageTray,
    togglePicker,
    toggleVersions,
    toggleLineWrap,
    toggleContentWidth,
    cycleTheme,
    showWelcome,
    unmarkdownConfirmOpen,
    versionsOpen,
  ]);

  return (
    <div className={`app${newDocPulse ? " app-new-pulse" : ""}`}>
      <div className="editor-column">
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
      <div
        className={`editor-shell${imageDragging ? " editor-shell-image-drag" : ""}`}
      >
        {diffSelection && path && versionReader && versionsSupported ? (
          <VersionDiff
            documentPath={path}
            readVersion={versionReader.read}
            readAttempt={versionReadAttempt}
            version={diffSelection.version}
            previousVersion={diffSelection.previousVersion}
            onClose={closeVersionDiff}
            onRetry={retryVersionReads}
          />
        ) : showWelcome ? (
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
        {(imageDragging || imageFeedback) && (
          <div className="image-drop-feedback" role="status" aria-live="polite">
            {imageDragging ? "Drop image" : imageFeedback}
          </div>
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
                    keys={["⌘", "I"]}
                    className="chrome-tip-left"
                    visible={activeHint === "images"}
                  />
                  <button
                    type="button"
                    className="statusbar-toggle"
                    aria-label={`Images, ${imageCount}. ⌘I.`}
                    onClick={toggleImageTray}
                  >
                    <ImagesIcon className="statusbar-toggle-icon" />
                    {imageCount > 0 && (
                      <span className="statusbar-toggle-value">{imageCount}</span>
                    )}
                  </button>
                </span>
              )}
              {versionsAvailable && (
                <span
                  className="chrome-tip-wrap"
                  onMouseEnter={() => showHint("versions")}
                  onMouseLeave={hideHint}
                  onFocus={() => showHint("versions")}
                  onBlur={hideHint}
                >
                  <ChromeHint
                    name={
                      versionCatalogError ? "Versions unavailable" : "Versions"
                    }
                    keys={["⌥", "⌘", "V"]}
                    className="chrome-tip-left"
                    visible={activeHint === "versions"}
                  />
                  <button
                    type="button"
                    className="statusbar-toggle"
                    aria-label={
                      versionCatalogError
                        ? "Versions unavailable. Open to retry. Command Option V."
                        : `Versions, ${versions.length}. Command Option V.`
                    }
                    onClick={toggleVersions}
                  >
                    <VersionsIcon className="statusbar-toggle-icon" />
                    {versions.length > 0 && (
                      <span className="statusbar-toggle-value">{versions.length}</span>
                    )}
                  </button>
                </span>
              )}
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
            onMouseEnter={() => showHint("unmarkdown")}
            onMouseLeave={hideHint}
            onFocus={() => showHint("unmarkdown")}
            onBlur={hideHint}
          >
            <ChromeHint
              name="Unmarkdown"
              keys={["⇧", "⌘", "R"]}
              className="chrome-tip-right"
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
      </div>
      {path && versionReader && versionsAvailable && onboardingComplete && (
        <VersionHistory
          open={versionsOpen}
          documentPath={path}
          currentText={text}
          versions={versions}
          catalogError={versionCatalogError}
          readAttempt={versionReadAttempt}
          saving={versionSaving}
          saveError={versionSaveError}
          readVersion={versionReader.read}
          onSave={saveCurrentVersion}
          onDelete={deleteVersion}
          onRetryCatalog={retryVersionCatalog}
          onRetryReads={retryVersionReads}
          selectedVersionId={diffSelection?.version.id ?? null}
          onClose={() => {
            setVersionsOpen(false);
            closeVersionDiff();
          }}
          onSelectCurrent={closeVersionDiff}
          onSelectVersion={(version, previousVersion) => {
            setDiffSelection({ version, previousVersion });
          }}
        />
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
