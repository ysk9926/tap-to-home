"use client";

import { useEffect } from "react";

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_INTERVAL_MS = 30 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDay(now: number): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function nextKstMidnight(now: number): number {
  const shifted = new Date(now + KST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - KST_OFFSET_MS;
}

/** 인증된 일반 앱이 전경·온라인일 때만 서버 관측 방문을 갱신한다. */
export function ActivityTracker({ userId }: { userId: string }) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let lastAttemptAt = 0;
    let lastAttemptDay = "";

    const ready = () => document.visibilityState === "visible" && navigator.onLine;

    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay?: number) => {
      clearTimer();
      if (stopped || !ready()) return;
      const now = Date.now();
      const nextAllowed = lastAttemptAt > 0 ? lastAttemptAt + UPDATE_INTERVAL_MS : now;
      const dueAt = delay === undefined
        ? Math.min(Math.max(now, nextAllowed), nextKstMidnight(now))
        : now + delay;
      timer = setTimeout(() => void collect(), Math.max(0, dueAt - now));
    };

    const collect = async () => {
      clearTimer();
      if (stopped || controller || !ready()) return;
      const now = Date.now();
      const day = kstDay(now);
      if (day === lastAttemptDay && now - lastAttemptAt < UPDATE_INTERVAL_MS) {
        schedule();
        return;
      }

      lastAttemptAt = now;
      lastAttemptDay = day;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const response = await fetch("/api/activity", {
          method: "POST",
          credentials: "same-origin",
          signal: requestController.signal,
        });
        if (!response.ok) throw new Error(`activity collection failed: ${response.status}`);
        controller = undefined;
        schedule();
      } catch {
        const aborted = requestController.signal.aborted;
        controller = undefined;
        if (!stopped && !aborted) {
          lastAttemptAt = 0;
          lastAttemptDay = "";
          schedule(RETRY_INTERVAL_MS);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void collect();
      else clearTimer();
    };
    const onOnline = () => void collect();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    void collect();

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [userId]);

  return null;
}
