"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { todayKst } from "@/lib/kst";
import { isAppOnline, isAppVisible } from "../browser-activity";
import { subscribeNativeResume } from "../native-lifecycle";
import { userSyncKeys } from "../query-keys";
import { createReconciler, type ReconcileReason } from "../reconciler";

export function useSyncReconciliation({ userId, active, ownConnected, raceConnected }: {
  userId: string; active: boolean; ownConnected: boolean; raceConnected: boolean;
}) {
  const client = useQueryClient();
  const request = useRef<((reason: ReconcileReason) => void) | null>(null);
  const previous = useRef({ ownConnected: false, raceConnected: false });

  useEffect(() => {
    if (!active) return;
    let requestedAt = 0;
    const fullFetchCompletedAt = new Map<string, number>();
    const syncKeys = userSyncKeys(userId);
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success" || event.action.manual) return;
      if (syncKeys.some((key) => JSON.stringify(key) === JSON.stringify(event.query.queryKey))) {
        fullFetchCompletedAt.set(event.query.queryHash, Date.now());
      }
    });
    let date = todayKst();
    let midnight: ReturnType<typeof setTimeout>;
    const reconciler = createReconciler({
      canRun: () => isAppVisible() && isAppOnline(),
      run: async () => {
        // 실시간 setQueryData가 아닌 실제 HTTP 완료만 중복 보정에서 제외한다.
        await Promise.all(syncKeys.map((queryKey) => client.refetchQueries({
          queryKey, exact: true, type: "active",
          predicate: (query) => (fullFetchCompletedAt.get(query.queryHash) ?? 0) < requestedAt || query.state.isInvalidated,
        }, { cancelRefetch: false })));
      },
    });
    const schedule = (reason: ReconcileReason) => {
      requestedAt = Date.now();
      reconciler.request(reason);
    };
    request.current = schedule;
    const onResume = () => {
      if (!isAppVisible()) return;
      const nextDate = todayKst();
      schedule(nextDate === date ? "resume" : "midnight");
      date = nextDate;
    };
    const onOnline = () => schedule("online");
    const armMidnight = () => {
      const next = new Date(`${todayKst()}T00:00:00+09:00`).getTime() + 86_400_000;
      midnight = setTimeout(() => {
        date = todayKst();
        schedule("midnight");
        armMidnight();
      }, Math.max(1, next - Date.now()));
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("online", onOnline);
    const unsubscribeNativeResume = subscribeNativeResume(onResume);
    armMidnight();
    return () => {
      request.current = null;
      unsubscribe();
      clearTimeout(midnight);
      reconciler.dispose();
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("online", onOnline);
      unsubscribeNativeResume();
    };
  }, [active, client, userId]);

  useEffect(() => {
    if ((ownConnected && !previous.current.ownConnected) || (raceConnected && !previous.current.raceConnected)) {
      request.current?.("realtime");
    }
    previous.current = { ownConnected, raceConnected };
  }, [ownConnected, raceConnected]);
}
