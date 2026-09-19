"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RACE_TODAY_KEY } from "@/features/race/hooks/use-race-today";
import { fetchJson } from "@/lib/fetch-json";
import { FRIENDS_KEY } from "./use-friends";
import type { FriendSummary, RequestResult } from "../server/friends";

type RequestAction = "accept" | "decline" | "cancel";

/**
 * 친구 관계를 바꾸는 호출 묶음. 모두 성공 시 친구 목록과 레이스를 다시 읽는다 —
 * 친구가 늘거나 줄면 레이스 참가자도 함께 바뀐다.
 */
export function useFriendActions() {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY }),
      queryClient.invalidateQueries({ queryKey: RACE_TODAY_KEY }),
    ]);
  };

  const request = useMutation({
    mutationFn: (username: string) =>
      fetchJson<RequestResult>("/api/friends", { method: "POST", body: JSON.stringify({ username }) }),
    onSuccess: refresh,
  });

  const respond = useMutation({
    mutationFn: ({ id, action }: { id: string; action: RequestAction }) =>
      fetchJson<{ friend?: FriendSummary }>(`/api/friends/requests/${id}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => fetchJson(`/api/friends/${userId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const block = useMutation({
    mutationFn: (userId: string) => fetchJson(`/api/friends/${userId}`, { method: "POST" }),
    onSuccess: refresh,
  });

  const unblock = useMutation({
    mutationFn: (friendshipId: string) =>
      fetchJson(`/api/friends/blocks/${friendshipId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  return { request, respond, remove, block, unblock };
}
