"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchJson, fetchWithTimeout } from "@/lib/fetch-json";
import { notifySessionExpiredForStatus } from "@/lib/auth/session-events";
import { signalsUnreadKey } from "@/features/realtime/query-keys";
import { isAppVisible } from "@/features/realtime/browser-activity";
import { retrySyncQuery, type QueryPolicy } from "@/features/realtime/sync-policy";
import { useSyncPolling } from "@/features/realtime/hooks/use-sync-polling";
import type { UnreadSignal } from "../server/signals";
import { createSignalInbox, type SignalInbox } from "../signal-inbox";

export const TOAST_TTL_MS = 4000;
export type ToastItem = UnreadSignal;

export function useSignalToasts({ userId, active, visible, policy }: {
  userId: string; active: boolean; visible: boolean; policy: QueryPolicy;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const inbox = useRef<SignalInbox | null>(null);
  const deferred = useRef(new Map<string, UnreadSignal>());

  useEffect(() => {
    if (!active) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const pending = deferred.current;
    const current = createSignalInbox({
      now: Date.now,
      visible: isAppVisible,
      onToast: (signal) => {
        setToasts((prev) => [...prev, signal]);
        const timer = setTimeout(() => {
          timers.delete(timer);
          setToasts((prev) => prev.filter((toast) => toast.id !== signal.id));
        }, TOAST_TTL_MS);
        timers.add(timer);
      },
      acknowledge: async (ids) => {
        const response = await fetchWithTimeout("/api/signals/read", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        notifySessionExpiredForStatus(response.status);
        if (!response.ok) throw new ApiError(response.status, "신호 수신 확인에 실패했어요");
      },
    });
    inbox.current = current;
    return () => {
      inbox.current = null;
      current.dispose();
      timers.forEach(clearTimeout);
      pending.clear();
    };
  }, [userId, active]);

  const unread = useQuery({
    queryKey: signalsUnreadKey(userId),
    ...policy,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: retrySyncQuery,
    queryFn: ({ signal }) => fetchJson<{ signals: UnreadSignal[] }>("/api/signals/unread", { signal }).then((result) => result.signals),
  });
  useSyncPolling(policy, unread.refetch);

  useEffect(() => {
    if (!active) return;
    unread.data?.forEach((signal) => deferred.current.set(signal.id, signal));
    if (!visible) return;
    deferred.current.forEach((signal) => inbox.current?.accept(signal, "poll"));
    deferred.current.clear();
  }, [unread.data, unread.dataUpdatedAt, visible, active]);

  const push = useCallback((signal: UnreadSignal) => { inbox.current?.accept(signal, "realtime"); }, []);
  return { toasts, push };
}
