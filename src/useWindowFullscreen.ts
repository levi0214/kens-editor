import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

function applyFullscreen(active: boolean): void {
  if (active) {
    document.documentElement.dataset.fullscreen = "true";
  } else {
    delete document.documentElement.dataset.fullscreen;
  }
}

export function useWindowFullscreen(): void {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      return;
    }

    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let lastActive: boolean | undefined;

    const sync = async () => {
      const active = await appWindow.isFullscreen();
      if (cancelled || lastActive === active) {
        return;
      }

      lastActive = active;
      applyFullscreen(active);
    };

    void sync();

    void appWindow.onResized(() => {
      void sync();
    }).then((stop) => {
      unlisten = stop;
    });

    return () => {
      cancelled = true;
      unlisten?.();
      applyFullscreen(false);
    };
  }, []);
}
