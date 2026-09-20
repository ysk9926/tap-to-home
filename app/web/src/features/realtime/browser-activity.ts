"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  document.addEventListener("visibilitychange", listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function isAppVisible() { return typeof document === "undefined" || document.visibilityState !== "hidden"; }
export function isAppOnline() { return typeof navigator === "undefined" || navigator.onLine; }

export function useBrowserActivity() {
  const visible = useSyncExternalStore(subscribe, isAppVisible, () => true);
  const online = useSyncExternalStore(subscribe, isAppOnline, () => true);
  return { visible, online };
}
