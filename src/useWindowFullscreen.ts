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
    const unlisteners: Array<() => void> = [];
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

    const track = (listen: Promise<() => void>) => {
      void listen.then((stop) => {
        if (cancelled) {
          stop();
          return;
        }
        unlisteners.push(stop);
      });
    };

    void sync();
    track(appWindow.onResized(() => {
      void sync();
    }));
    track(appWindow.onFocusChanged(() => {
      void sync();
    }));

    return () => {
      cancelled = true;
      for (const stop of unlisteners) {
        stop();
      }
      applyFullscreen(false);
    };
  }, []);
}
