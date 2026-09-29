import { useCallback, useEffect, useRef, useState } from "react";

const CHROME_IDLE_MS = 800;

export function useChromeIdle(
  active: boolean,
  pinned = false,
): { visible: boolean; bump: () => void } {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | undefined>(undefined);
  const mousePositionRef = useRef<{ x: number; y: number } | undefined>(undefined);

  const bump = useCallback(() => {
    setVisible(true);

    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }

    if (!active || pinned) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = undefined;
    }, CHROME_IDLE_MS);
  }, [active, pinned]);

  useEffect(() => {
    if (!active) {
      setVisible(true);
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const previous = mousePositionRef.current;
      mousePositionRef.current = { x: event.screenX, y: event.screenY };

      // Scrolling can emit mousemove without moving the pointer.
      const moved = previous
        ? previous.x !== event.screenX || previous.y !== event.screenY
        : event.movementX !== 0 || event.movementY !== 0;
      if (moved) bump();
    };

    window.addEventListener("mousemove", onMouseMove);
    bump();

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [active, bump]);

  useEffect(() => {
    if (pinned) {
      setVisible(true);
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    } else if (active) {
      bump();
    }
  }, [pinned, active, bump]);

  return { visible, bump };
}
