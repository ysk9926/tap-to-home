"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { RaceToday } from "../race-state";

export const RACE_TODAY_KEY = ["race", "today"] as const;
export const RACE_POLL_MS = 2000;

/**
 * 오늘 레이스 상태. polling=true 면 2초마다 refetch (Realtime 연결 전 B 안).
 * 서버 값이 낙관적 로컬 카운트보다 작으면(아직 배치 전송 전) 로컬 값을 유지한다.
 */
export function useRaceToday(initial: RaceToday, { polling }: { polling: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: RACE_TODAY_KEY,
    initialData: initial,
    staleTime: 0,
    refetchInterval: polling ? RACE_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const fresh = await fetchJson<RaceToday>("/api/race/today");
      const prev = queryClient.getQueryData<RaceToday>(RACE_TODAY_KEY);
      if (!prev || prev.date !== fresh.date) return fresh;
      if (fresh.settled) return fresh; // 마감 후에는 서버 값이 진실이다 (로컬 낙관값을 고정하지 않는다)
      if (prev.me.tapCount <= fresh.me.tapCount) return fresh;
      // 로컬이 앞서 있음: 내 카운트만 로컬 값으로 되돌린다
      const keepMine = (r: RaceToday["racers"][number]) =>
        r.isMe ? { ...r, tapCount: prev.me.tapCount, stage: prev.me.stage } : r;
      return { ...fresh, me: keepMine(fresh.me), racers: fresh.racers.map(keepMine) };
    },
  });
}
