"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { raceTodayKey } from "@/features/realtime/query-keys";
import { retrySyncQuery, type QueryPolicy } from "@/features/realtime/sync-policy";
import { useSyncPolling } from "@/features/realtime/hooks/use-sync-polling";
import { mergeRaceSnapshot, selectRaceInitial, type RaceToday } from "../race-state";

export function useRaceToday(userId: string, initial: RaceToday, policy: QueryPolicy) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: raceTodayKey(userId),
    initialData: initial,
    ...policy,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: retrySyncQuery,
    queryFn: async ({ signal }) => {
      const fresh = await fetchJson<RaceToday>("/api/race/today", { signal });
      const prev = client.getQueryData<RaceToday>(raceTodayKey(userId));
      return mergeRaceSnapshot(prev, fresh);
    },
  });
  useSyncPolling(policy, query.refetch);

  useEffect(() => {
    const current = client.getQueryData<RaceToday>(raceTodayKey(userId));
    if (!current || selectRaceInitial(current, initial) !== current) {
      client.setQueryData(raceTodayKey(userId), initial);
    }
  }, [client, userId, initial]);

  // 정산 직후 첫 렌더부터 버튼을 잠근다. 캐시 반영 effect까지 기다리지 않는다.
  return { ...query, data: selectRaceInitial(query.data, initial) };
}
