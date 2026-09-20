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
 *
 * `settlementPending` 이 true 인 동안은 열지 않는다. `MarkerDialog` 는 네이티브
 * `<dialog>` + `showModal()` 을 쓰는데 동시에 열리는 모달은 top layer 에 showModal() 을
 * "나중에 호출한" 쪽이 위로 쌓인다 — 레이아웃의 DOM 순서로는 어느 쪽이 위에 뜰지 정할 수
 * 없다. 그래서 안 본 정산 결과(SettlementWatcher)가 있는 동안은 이 다이얼로그 자체를
 * 열지 않는 방식으로 순서를 강제한다. 결과를 닫으면 seenAt 이 채워지고
 * `router.refresh()` 로 레이아웃이 다시 렌더돼 이 값이 false 가 되면서 자연히 풀린다.
 * (이 게이트를 "단순화"하고 DOM 순서만 믿으면 두 다이얼로그가 뜨는 순간 뒤집힐 수 있다.)
 */
export function FriendRequestWatcher({ settlementPending = false }: { settlementPending?: boolean }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { userId, friends: data } = useLiveSync();
  const { respond } = useFriendActions(userId);

  // 처리·닫기 한 요청은 건너뛰고 다음 요청을 올린다. 사라진 id 가 dismissed 에 남아도
  // 무해하므로(같은 id 가 다시 생기지 않는다) 정리 effect 를 두지 않는다.
  const pending = data.incoming.find((r) => !dismissed.includes(r.id));

  return (
    <MarkerDialog
      open={pending !== undefined && !settlementPending}
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
