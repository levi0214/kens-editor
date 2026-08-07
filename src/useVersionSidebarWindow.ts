import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { planWindowExpansion } from "./windowExpansion";

const SIDEBAR_WIDTH = 292;
const SAVED_FRAME_KEY = "kens-editor:versions-window-frame";

interface SavedWindowFrame {
  position: PhysicalPosition;
  innerSize: PhysicalSize;
}

interface StoredWindowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function readSavedFrame(): SavedWindowFrame | null {
  try {
    const value = window.sessionStorage.getItem(SAVED_FRAME_KEY);
    if (!value) {
      return null;
    }

    const frame = JSON.parse(value) as StoredWindowFrame;
    if (![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)) {
      return null;
    }

    return {
      position: new PhysicalPosition(frame.x, frame.y),
      innerSize: new PhysicalSize(frame.width, frame.height),
    };
  } catch {
    return null;
  }
}

function writeSavedFrame(frame: SavedWindowFrame | null): void {
  try {
    if (!frame) {
      window.sessionStorage.removeItem(SAVED_FRAME_KEY);
      return;
    }

    window.sessionStorage.setItem(
      SAVED_FRAME_KEY,
      JSON.stringify({
        x: frame.position.x,
        y: frame.position.y,
        width: frame.innerSize.width,
        height: frame.innerSize.height,
      } satisfies StoredWindowFrame),
    );
  } catch {
    // Window restoration still works for the lifetime of this component.
  }
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function useVersionSidebarWindow(open: boolean): void {
  const savedFrameRef = useRef<SavedWindowFrame | null>(readSavedFrame());
  const operationRef = useRef(Promise.resolve());

  useEffect(() => {
    operationRef.current = operationRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isTauri()) {
          return;
        }

        const appWindow = getCurrentWindow();
        if (!open) {
          const savedFrame = savedFrameRef.current;
          if (savedFrame) {
            try {
              await appWindow.setSize(savedFrame.innerSize);
              await appWindow.setPosition(savedFrame.position);
              savedFrameRef.current = null;
              writeSavedFrame(null);
            } catch {
              // Keep the original frame. A later close can retry, and opening
              // again must never expand from an already-expanded window.
            }
          }
          return;
        }

        if (savedFrameRef.current) {
          return;
        }

        const [fullscreen, maximized, monitor, position, outerSize, innerSize] =
          await Promise.all([
            appWindow.isFullscreen(),
            appWindow.isMaximized(),
            currentMonitor(),
            appWindow.outerPosition(),
            appWindow.outerSize(),
            appWindow.innerSize(),
          ]);

        if (fullscreen || maximized || !monitor) {
          return;
        }

        const plan = planWindowExpansion(
          {
            x: position.x,
            y: position.y,
            width: outerSize.width,
            height: outerSize.height,
          },
          {
            x: monitor.workArea.position.x,
            y: monitor.workArea.position.y,
            width: monitor.workArea.size.width,
            height: monitor.workArea.size.height,
          },
          Math.round(SIDEBAR_WIDTH * monitor.scaleFactor),
        );

        if (plan.addedWidth === 0) {
          return;
        }

        const savedFrame = { position, innerSize };
        savedFrameRef.current = savedFrame;
        writeSavedFrame(savedFrame);
        try {
          if (plan.x !== position.x) {
            await appWindow.setPosition(new PhysicalPosition(plan.x, position.y));
          }
          await appWindow.setSize(
            new PhysicalSize(innerSize.width + plan.addedWidth, innerSize.height),
          );
        } catch {
          let restored = true;
          await appWindow.setSize(innerSize).catch(() => {
            restored = false;
          });
          await appWindow.setPosition(position).catch(() => {
            restored = false;
          });
          if (restored) {
            savedFrameRef.current = null;
            writeSavedFrame(null);
          }
        }
      });
  }, [open]);
}
