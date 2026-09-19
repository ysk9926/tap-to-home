"use client";

import { useState, type FormEvent } from "react";
import { MarkerBox } from "@/components/marker-box";
import { MarkerButton } from "@/components/marker-button";
import { Note, ScreenTitle } from "@/components/paper";
import { TextField } from "@/components/text-field";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { useMutation } from "@tanstack/react-query";
import { useFriendActions } from "../hooks/use-friend-actions";
import { useFriends, type FriendsState } from "../hooks/use-friends";
import { ConfirmFriendDialog, type PendingConfirm } from "./confirm-friend-dialog";
import type { FoundUser } from "../server/friends";

type Props = { me: { name: string; username: string }; initialFriends: FriendsState };

export function FriendsScreen({ me, initialFriends }: Props) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = 검색 전
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  // 이 화면은 항상 폴링한다 — 레이스 화면과 달리 Realtime 연결 여부를 알지 못한다
  const state = useFriends(initialFriends, { polling: true });
  const { request, respond, remove, block, unblock } = useFriendActions();
  const { friends, incoming, outgoing, blocked } = state.data;

  const fail = (e: unknown, fallback: string) =>
    setMessage(e instanceof ApiError ? e.message : fallback);

  const search = useMutation({
    mutationFn: (username: string) =>
      fetchJson<{ user: FoundUser | null }>(`/api/users/search?username=${encodeURIComponent(username)}`),
    onSuccess: ({ user }) => {
      setFound(user);
      setMessage(user ? null : "그 아이디는 없어요");
    },
    onError: (e) => fail(e, "검색에 실패했어요"),
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setMessage(null);
    search.mutate(query.trim());
  }

  function handleRequest(username: string) {
    request.mutate(username, {
      onSuccess: (result) => {
        setFound(undefined);
        setQuery("");
        setMessage(
          result.kind === "accepted"
            ? `${result.friend.name} 님과 친구가 됐어요`
            : `${result.request.user.name} 님에게 요청을 보냈어요`,
        );
      },
      onError: (e) => fail(e, "요청에 실패했어요"),
    });
  }

  function handleConfirmed(c: PendingConfirm) {
    setConfirm(null);
    const onError = (e: unknown) => fail(e, "처리에 실패했어요");
    if (c.kind === "remove") {
      remove.mutate(c.user.id, { onSuccess: () => setMessage(`${c.user.name} 님을 삭제했어요`), onError });
    } else {
      block.mutate(c.user.id, { onSuccess: () => setMessage(`${c.user.name} 님을 차단했어요`), onError });
    }
  }

  const busy = respond.isPending || remove.isPending || block.isPending || unblock.isPending;

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
        <MarkerBox lifted className="mt-4 flex items-center justify-between gap-3 px-4 py-3">
          <UserLabel name={found.name} username={found.username} />
          <MarkerButton size="sm" disabled={request.isPending} onClick={() => handleRequest(found.username)}>
            친구 요청
          </MarkerButton>
        </MarkerBox>
      )}
      {message && <Note className="mt-3">{message}</Note>}

      {incoming.length > 0 && (
        <Section title="받은 요청" count={incoming.length}>
          <ul className="mt-2 divide-y divide-line">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <UserLabel name={r.user.name} username={r.user.username} />
                <span className="flex shrink-0 gap-2">
                  <MarkerButton
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      respond.mutate(
                        { id: r.id, action: "accept" },
                        {
                          onSuccess: () => setMessage(`${r.user.name} 님과 친구가 됐어요`),
                          onError: (e) => fail(e, "수락에 실패했어요"),
                        },
                      )
                    }
                  >
                    수락
                  </MarkerButton>
                  <MarkerButton
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      respond.mutate(
                        { id: r.id, action: "decline" },
                        { onError: (e) => fail(e, "거절에 실패했어요") },
                      )
                    }
                  >
                    거절
                  </MarkerButton>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="보낸 요청" count={outgoing.length}>
          <ul className="mt-2 divide-y divide-line">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <UserLabel name={r.user.name} username={r.user.username} muted />
                <MarkerButton
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    respond.mutate(
                      { id: r.id, action: "cancel" },
                      { onError: (e) => fail(e, "취소에 실패했어요") },
                    )
                  }
                >
                  취소
                </MarkerButton>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="내 친구" count={friends.length}>
        {friends.length === 0 ? (
          <Note className="mt-2">아직 없어요. 위에서 아이디로 찾아 요청해요.</Note>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {friends.map((f) => (
              <li key={f.userId} className="flex items-center justify-between gap-2 py-2">
                <UserLabel name={f.name} username={f.username} />
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular text-pencil">오늘 {f.tapCount}번</span>
                  <MarkerButton
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({ kind: "remove", user: { id: f.userId, name: f.name, username: f.username } })
                    }
                  >
                    삭제
                  </MarkerButton>
                  <MarkerButton
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({ kind: "block", user: { id: f.userId, name: f.name, username: f.username } })
                    }
                  >
                    차단
                  </MarkerButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {blocked.length > 0 && (
        <Section title="차단한 사람" count={blocked.length}>
          <ul className="mt-2 divide-y divide-line">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                <UserLabel name={b.user.name} username={b.user.username} muted />
                <MarkerButton
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    unblock.mutate(b.id, {
                      onSuccess: () => setMessage(`${b.user.name} 님의 차단을 풀었어요`),
                      onError: (e) => fail(e, "해제에 실패했어요"),
                    })
                  }
                >
                  차단 해제
                </MarkerButton>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ConfirmFriendDialog
        pending={confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirmed}
      />
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between text-xl font-bold">
        <span>{title}</span>
        <span className="tabular font-normal text-pencil">{count}명</span>
      </div>
      {children}
    </section>
  );
}

function UserLabel({ name, username, muted }: { name: string; username: string; muted?: boolean }) {
  return (
    <span className="min-w-0 truncate">
      <b className={muted ? "text-pencil" : undefined}>{name}</b>
      <span className="ml-2 font-note text-lg text-pencil-soft">@{username}</span>
    </span>
  );
}
