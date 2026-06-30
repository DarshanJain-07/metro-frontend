"use client";

import { useCallback, useEffect, useRef } from "react";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "mousemove",
];

const CHECK_INTERVAL_MS = 10_000;
const THROTTLE_DELAY_MS = 2_000;

const LAST_ACTIVITY_KEY = "last_activity";
const AUTH_EXPIRED_KEY = "auth_expired_at";

type InactivityTimeoutOptions = {
  enabled: boolean;
  timeoutMinutes: number;
  onTimeoutAction?: () => void;
};

function safeGetStorageNumber(key: string): number | null {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function useInactivityTimeout({
  enabled,
  timeoutMinutes,
  onTimeoutAction,
}: InactivityTimeoutOptions) {
  const lastActivityRef = useRef<number>(0);
  const throttleRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const onTimeoutActionRef = useRef(onTimeoutAction);

  useEffect(() => {
    onTimeoutActionRef.current = onTimeoutAction;
  }, [onTimeoutAction]);

  const triggerTimeout = useCallback(() => {
    if (hasTriggeredRef.current) return;

    hasTriggeredRef.current = true;

    const now = Date.now();

    safeRemoveStorage(LAST_ACTIVITY_KEY);
    safeSetStorage(AUTH_EXPIRED_KEY, String(now));

    if (onTimeoutActionRef.current) {
      onTimeoutActionRef.current();
    } else {
      window.dispatchEvent(new Event("metro:auth-expired"));
    }
  }, []);

  const checkExpiry = useCallback(() => {
    if (!enabled || timeoutMinutes <= 0 || hasTriggeredRef.current) {
      return false;
    }

    const now = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const storedActivity = safeGetStorageNumber(LAST_ACTIVITY_KEY);

    if (storedActivity && storedActivity > lastActivityRef.current) {
      lastActivityRef.current = storedActivity;
    }

    if (!lastActivityRef.current) {
      lastActivityRef.current = now;
      safeSetStorage(LAST_ACTIVITY_KEY, String(now));
      return false;
    }

    const isExpired = now - lastActivityRef.current >= timeoutMs;

    if (isExpired) {
      triggerTimeout();
      return true;
    }

    return false;
  }, [enabled, timeoutMinutes, triggerTimeout]);

  const updateActivity = useCallback(() => {
    if (!enabled || timeoutMinutes <= 0 || hasTriggeredRef.current) return;

    const expired = checkExpiry();
    if (expired) return;

    const now = Date.now();

    lastActivityRef.current = now;

    if (now - throttleRef.current > THROTTLE_DELAY_MS) {
      throttleRef.current = now;
      safeSetStorage(LAST_ACTIVITY_KEY, String(now));
    }
  }, [enabled, timeoutMinutes, checkExpiry]);

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return;

    const now = Date.now();

    // Clear stale expired state when this authenticated inactivity hook starts.
    safeRemoveStorage(AUTH_EXPIRED_KEY);

    const storedActivity = safeGetStorageNumber(LAST_ACTIVITY_KEY);

    lastActivityRef.current = storedActivity ?? now;
    hasTriggeredRef.current = false;

    if (!storedActivity) {
      safeSetStorage(LAST_ACTIVITY_KEY, String(now));
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_EXPIRED_KEY && event.newValue) {
        triggerTimeout();
        return;
      }

      if (event.key === LAST_ACTIVITY_KEY) {
        const value = event.newValue ? Number(event.newValue) : null;

        if (
          value &&
          Number.isFinite(value) &&
          value > lastActivityRef.current
        ) {
          lastActivityRef.current = value;
          hasTriggeredRef.current = false;
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkExpiry();
      }
    };

    const listenerOptions: AddEventListenerOptions = { passive: true };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, updateActivity, listenerOptions);
    }

    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    const intervalId = window.setInterval(checkExpiry, CHECK_INTERVAL_MS);

    checkExpiry();

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, updateActivity);
      }

      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(intervalId);
    };
  }, [enabled, timeoutMinutes, updateActivity, checkExpiry, triggerTimeout]);
}
