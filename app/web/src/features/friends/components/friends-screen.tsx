"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { MarkerBox } from "@/components/marker-box";
import { MarkerButton } from "@/components/marker-button";
import { Note, ScreenTitle } from "@/components/paper";
import { TextField } from "@/components/text-field";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { RACE_TODAY_KEY } from "@/features/race/hooks/use-race-today";
import type { FoundUser, FriendSummary } from "../server/friends";

export const FRIENDS_KEY = ["friends"] as const;

type Props = { me: { name: string; username: string }; initialFriends: FriendSummary[] };

export function FriendsScreen({ me, initialFriends }: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = 검색 전
  const [message, setMessage] = useState<string | null>(null);

  const friends = useQuery({
    queryKey: FRIENDS_KEY,
    initialData: initialFriends,
    queryFn: () => fetchJson<{ friends: FriendSummary[] }>("/api/friends").then((r) => r.friends),
  });

  const search = useMutation({
    mutationFn: (username: string) =>
      fetchJson<{ user: FoundUser | null }>(`/api/users/search?username=${encodeURIComponent(username)}`),
    onSuccess: ({ user }) => {
      setFound(user);
      setMessage(user ? null : "그 아이디는 없어요");
    },
    onError: (e) => setMessage(e instanceof ApiError ? e.message : "검색에 실패했어요"),
  });

  const add = useMutation({
    mutationFn: (username: string) =>
      fetchJson<{ friend: FriendSummary }>("/api/friends", {
        method: "POST",
        body: JSON.stringify({ username }),
      }),
    onSuccess: ({ friend }) => {
      setFound(undefined);
      setQuery("");
      setMessage(`${friend.name} 님과 친구가 됐어요`);
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
      queryClient.invalidateQueries({ queryKey: RACE_TODAY_KEY });
    },
    onError: (e) => setMessage(e instanceof ApiError ? e.message : "등록에 실패했어요"),
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setMessage(null);
    search.mutate(query.trim());
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>친구</ScreenTitle>
      <Note>
        내 아이디 <b className="font-ui text-ink">@{me.username}</b> · 친구에게 알려주세요
      </Note>

      <form onSubmit={handleSearch} className="mt-5 flex items-end gap-3">
        <TextField
          label="친구 아이디로 찾기"
          autoCapitalize="none"
          placeholder="friend_id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <MarkerButton type="submit" size="sm" disabled={search.isPending}>
          찾기
        </MarkerButton>
      </form>

      {found && (
        <MarkerBox lifted className="mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xl font-bold">{found.name}</div>
            <div className="font-note text-lg text-pencil">@{found.username}</div>
          </div>
          <MarkerButton size="sm" disabled={add.isPending} onClick={() => add.mutate(found.username)}>
            친구 등록
          </MarkerButton>
        </MarkerBox>
      )}
      {message && <Note className="mt-3">{message}</Note>}

      <section className="mt-8">
        <div className="flex items-baseline justify-between text-xl font-bold">
          <span>내 친구</span>
          <span className="tabular font-normal text-pencil">{friends.data.length}명</span>
        </div>
        {friends.data.length === 0 ? (
          <Note className="mt-2">아직 없어요. 위에서 아이디로 찾아 등록해요.</Note>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {friends.data.map((f) => (
              <li key={f.userId} className="flex h-8 items-center justify-between">
                <span>
                  <b>{f.name}</b>
                  <span className="ml-2 font-note text-lg text-pencil-soft">@{f.username}</span>
                </span>
                <span className="tabular text-pencil">오늘 {f.tapCount}번</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
