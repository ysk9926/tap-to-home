"use client";

import { useEffect } from "react";
import { isAppOnline, isAppVisible } from "../browser-activity";
import type { QueryPolicy } from "../sync-policy";

/** 캐시의 실시간/낙관적 갱신과 무관하게 보정 주기를 유지한다. */
export function useSyncPolling(
  { enabled, refetchInterval }: QueryPolicy,
  refetch: (options: { cancelRefetch: boolean }) => Promise<unknown>,
) {
  useEffect(() => {
    if (!enabled || refetchInterval === false) return;
    const timer = setInterval(() => {
      if (isAppVisible() && isAppOnline()) void refetch({ cancelRefetch: false });
    }, refetchInterval);
    return () => clearInterval(timer);
  }, [enabled, refetchInterval, refetch]);
}
