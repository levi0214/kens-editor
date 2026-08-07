import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import {
  planWindowContraction,
  planWindowExpansion,
} from "./windowExpansion";

const SIDEBAR_WIDTH = 292;
const SAVED_FRAME_KEY = "kens-editor:versions-window-frame";

interface ExpandedWindowAdjustment {
  kind: "expanded";
  addedWidth: number;
  shiftedX: number;
}

interface ClosingWindowTarget {
  kind: "closing";
  x: number;
  y: number;
  width: number;
  height: number;
}

type SavedWindowState = ExpandedWindowAdjustment | ClosingWindowTarget;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readSavedState(): SavedWindowState | null {
  try {
    const value = window.sessionStorage.getItem(SAVED_FRAME_KEY);
    if (!value) {
      return null;
    }

    const state = JSON.parse(value) as Record<string, unknown>;
    if (
      state.kind === "expanded" &&
      isFiniteNumber(state.addedWidth) &&
      isFiniteNumber(state.shiftedX) &&
      state.addedWidth > 0 &&
      state.shiftedX >= 0
    ) {
      return {
        kind: "expanded",
        addedWidth: state.addedWidth,
        shiftedX: state.shiftedX,
      };
    }

    if (
      (state.kind === "closing" || state.kind === undefined) &&
      isFiniteNumber(state.x) &&
      isFiniteNumber(state.y) &&
      isFiniteNumber(state.width) &&
      isFiniteNumber(state.height) &&
      state.width > 0 &&
      state.height > 0
    ) {
      return {
        kind: "closing",
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function writeSavedState(state: SavedWindowState | null): void {
  try {
    if (!state) {
      window.sessionStorage.removeItem(SAVED_FRAME_KEY);
      return;
    }

    window.sessionStorage.setItem(SAVED_FRAME_KEY, JSON.stringify(state));
  } catch {
    // Window adjustment still works for the lifetime of this component.
  }
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function useVersionSidebarWindow(open: boolean): void {
  const savedStateRef = useRef<SavedWindowState | null>(readSavedState());
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
          const savedState = savedStateRef.current;
          if (!savedState) {
            return;
          }

          let target: ClosingWindowTarget;
          if (savedState.kind === "closing") {
            target = savedState;
          } else {
            const [monitor, position, outerSize, innerSize] = await Promise.all([
              currentMonitor(),
              appWindow.outerPosition(),
              appWindow.outerSize(),
              appWindow.innerSize(),
            ]);
            const removableWidth = Math.min(
              savedState.addedWidth,
              Math.max(0, innerSize.width - 1),
            );
            const plan = monitor
              ? planWindowContraction(
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
                  removableWidth,
                  savedState.shiftedX,
                )
              : {
                  removedWidth: removableWidth,
                  x: position.x + savedState.shiftedX,
                  y: position.y,
                };

            target = {
              kind: "closing",
              x: plan.x,
              y: plan.y,
              width: innerSize.width - plan.removedWidth,
              height: innerSize.height,
            };
            savedStateRef.current = target;
            writeSavedState(target);
          }

          await appWindow.setSize(new PhysicalSize(target.width, target.height));
          await appWindow.setPosition(new PhysicalPosition(target.x, target.y));
          savedStateRef.current = null;
          writeSavedState(null);
          return;
        }

        if (savedStateRef.current) {
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

        const adjustment: ExpandedWindowAdjustment = {
          kind: "expanded",
          addedWidth: plan.addedWidth,
          shiftedX: position.x - plan.x,
        };
        savedStateRef.current = adjustment;
        writeSavedState(adjustment);
        try {
          if (plan.x !== position.x) {
            await appWindow.setPosition(new PhysicalPosition(plan.x, position.y));
          }
          await appWindow.setSize(
            new PhysicalSize(innerSize.width + plan.addedWidth, innerSize.height),
          );
        } catch {
          const target: ClosingWindowTarget = {
            kind: "closing",
            x: position.x,
            y: position.y,
            width: innerSize.width,
            height: innerSize.height,
          };
          savedStateRef.current = target;
          writeSavedState(target);
          let restored = true;
          await appWindow.setSize(innerSize).catch(() => {
            restored = false;
          });
          await appWindow.setPosition(position).catch(() => {
            restored = false;
          });
          if (restored) {
            savedStateRef.current = null;
            writeSavedState(null);
          }
        }
      });
  }, [open]);
}
