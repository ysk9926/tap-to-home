"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import { friendsKey } from "@/features/realtime/query-keys";
import { retrySyncQuery, type QueryPolicy } from "@/features/realtime/sync-policy";
import { useSyncPolling } from "@/features/realtime/hooks/use-sync-polling";
import type { FriendsState } from "../server/friends-state";

export type { FriendsState };

/**
 * Provider가 한 번 조회하고 친구 화면과 요청 다이얼로그가 공유한다.
 * 연결 상태별 주기는 공통 정책을 따르며 friend 이벤트가 즉시 무효화한다.
 */
export function useFriends(userId: string, initial: FriendsState, policy: QueryPolicy) {
  const query = useQuery({
    queryKey: friendsKey(userId),
    initialData: initial,
    ...policy,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: retrySyncQuery,
    queryFn: ({ signal }) => fetchJson<FriendsState>("/api/friends", { signal }),
  });
  useSyncPolling(policy, query.refetch);
  return query;
}
