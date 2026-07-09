import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

/** Flush pending autosave before the window closes. */
export function useFlushOnClose(flush: () => Promise<void>): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onCloseRequested(async () => {
        await flush();
      })
      .then((stop) => {
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [flush]);
}
