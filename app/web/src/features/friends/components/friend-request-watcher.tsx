"use client";

import { useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { Note } from "@/components/paper";
import { useFriendActions } from "../hooks/use-friend-actions";
import { useLiveSync } from "@/features/realtime/live-sync-context";

/**
 * 앱 어디에 있든 받은 친구 요청을 다이얼로그로 띄운다 (F0-3). 한 번에 한 건씩 —
 * 여러 건이면 처리할 때마다 다음 요청이 올라온다. 닫으면 이 세션에서는 다시 띄우지 않고
 * `/friends` 목록에서 처리하게 둔다.
 */
export function FriendRequestWatcher() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { userId, friends: data } = useLiveSync();
  const { respond } = useFriendActions(userId);

  // 처리·닫기 한 요청은 건너뛰고 다음 요청을 올린다. 사라진 id 가 dismissed 에 남아도
  // 무해하므로(같은 id 가 다시 생기지 않는다) 정리 effect 를 두지 않는다.
  const pending = data.incoming.find((r) => !dismissed.includes(r.id));

  return (
    <MarkerDialog
      open={pending !== undefined}
      onClose={() => pending && setDismissed((prev) => [...prev, pending.id])}
      title="친구 요청이 왔어요"
      actions={
        <>
          <MarkerButton
            size="sm"
            variant="ghost"
            disabled={respond.isPending}
            onClick={() => pending && respond.mutate({ id: pending.id, action: "decline" })}
          >
            거절
          </MarkerButton>
          <MarkerButton
            size="sm"
            disabled={respond.isPending}
            onClick={() => pending && respond.mutate({ id: pending.id, action: "accept" })}
          >
            수락
          </MarkerButton>
        </>
      }
    >
      {pending && (
        <>
          <p className="text-xl">
            <b>{pending.user.name}</b>
            <span className="ml-2 font-note text-lg text-pencil-soft">@{pending.user.username}</span>
          </p>
          <Note className="mt-1">수락하면 오늘 레이스에서 서로가 보여요.</Note>
        </>
      )}
    </MarkerDialog>
  );
}
