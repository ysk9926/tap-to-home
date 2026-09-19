"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { UnreadSignal } from "@/features/signal/server/signals";

export const SIGNALS_UNREAD_KEY = ["signals", "unread"] as const;
export const SIGNAL_POLL_MS = 5000;
export const TOAST_TTL_MS = 4000;

export type ToastItem = UnreadSignal;

/**
 * 받은 신호 토스트 목록. polling=true 면 5초마다 미읽음을 가져온다 (서버가 읽음 처리).
 * Realtime 단계에서는 push() 로 직접 넣는다. 각 토스트는 4초 뒤 사라진다.
 */
export function useSignalToasts({ polling }: { polling: boolean }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((signal: ToastItem) => {
    setToasts((prev) => (prev.some((t) => t.id === signal.id) ? prev : [...prev, signal]));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== signal.id)), TOAST_TTL_MS);
  }, []);

  const unread = useQuery({
    queryKey: SIGNALS_UNREAD_KEY,
    enabled: polling,
    refetchInterval: polling ? SIGNAL_POLL_MS : false,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => fetchJson<{ signals: UnreadSignal[] }>("/api/signals/unread").then((r) => r.signals),
  });

  useEffect(() => {
    unread.data?.forEach(push);
  }, [unread.data, push]);

  return { toasts, push };
}
