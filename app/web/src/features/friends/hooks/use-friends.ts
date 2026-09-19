"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { FriendsState } from "../server/friends-state";

export const FRIENDS_KEY = ["friends"] as const;
/** Realtime 이 끊겼을 때만 쓰는 백업 주기. 요청은 자주 오는 이벤트가 아니라 넉넉히 둔다 */
export const FRIENDS_POLL_MS = 20_000;

export type { FriendsState };

/**
 * 친구 화면과 요청 다이얼로그가 함께 읽는 상태. 목록 넷을 한 요청으로 받는다.
 * `polling` 은 Realtime 미연결 시에만 켠다 — 연결돼 있으면 friend 이벤트가 invalidate 한다.
 */
export function useFriends(initial: FriendsState, { polling }: { polling: boolean }) {
  return useQuery({
    queryKey: FRIENDS_KEY,
    initialData: initial,
    staleTime: 0,
    refetchInterval: polling ? FRIENDS_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: () => fetchJson<FriendsState>("/api/friends"),
  });
}

/** friend 이벤트나 변경 mutation 뒤에 부른다 */
export function useInvalidateFriends() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
}
