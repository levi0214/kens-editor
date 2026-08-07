import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { planWindowExpansion } from "./windowExpansion";

const SIDEBAR_WIDTH = 292;

interface SavedWindowFrame {
  position: PhysicalPosition;
  innerSize: PhysicalSize;
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export function useVersionSidebarWindow(open: boolean): void {
  const savedFrameRef = useRef<SavedWindowFrame | null>(null);
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
          savedFrameRef.current = null;
          if (savedFrame) {
            await appWindow.setSize(savedFrame.innerSize);
            await appWindow.setPosition(savedFrame.position);
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
        try {
          if (plan.x !== position.x) {
            await appWindow.setPosition(new PhysicalPosition(plan.x, position.y));
          }
          await appWindow.setSize(
            new PhysicalSize(innerSize.width + plan.addedWidth, innerSize.height),
          );
          savedFrameRef.current = savedFrame;
        } catch {
          await appWindow.setPosition(position).catch(() => undefined);
        }
      });
  }, [open]);
}
