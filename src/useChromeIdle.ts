import { useCallback, useEffect, useRef, useState } from "react";

const CHROME_IDLE_MS = 800;

export function useChromeIdle(
  active: boolean,
  pinned = false,
): { visible: boolean; bump: () => void } {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | undefined>(undefined);

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

    const onMouseMove = () => bump();

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
