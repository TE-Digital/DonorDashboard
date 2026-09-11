// src/hooks/useIdleTimeout.ts
import { useEffect, useRef } from "react";

interface UseIdleTimeoutOptions {
  /** Inactivity duration in minutes before triggering callback (Default: 10 minutes) */
  timeoutInMinutes?: number;
  /** Custom callback when idle timeout is reached. Defaults to reloading page. */
  onIdle?: () => void;
  /** Whether the timer is enabled. Default: true. */
  enabled?: boolean;
}

/**
 * Custom hook to detect user inactivity (idle) and trigger an action (e.g. reload or logout)
 * after a specified period of no mouse movement, key press, scrolling, or touch events.
 */
export function useIdleTimeout({
  timeoutInMinutes = 10,
  onIdle,
  enabled = true,
}: UseIdleTimeoutOptions = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const timeoutMs = timeoutInMinutes * 60 * 1000;

    const handleIdle = () => {
      if (onIdle) {
        onIdle();
      } else {
        console.log(
          `[IdleTimeout] Inactive for ${timeoutInMinutes} minutes. Reloading page for security...`
        );
        window.location.reload();
      }
    };

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(handleIdle, timeoutMs);
    };

    // Events that indicate user activity
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    // Start timer initially
    resetTimer();

    // Attach activity listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [timeoutInMinutes, onIdle, enabled]);
}
