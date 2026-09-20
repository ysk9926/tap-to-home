"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { Stickman } from "@/components/stickman";
import { kstDateLabel } from "@/lib/kst";
import { markResultsSeenAction } from "../actions";
import { TITLE_BY_ID } from "../catalog";
import type { UnseenResult } from "../server/unseen-result";

/**
 * 자정에 정산된 결과를 앱 진입 시 한 번 띄운다. 푸시를 못 받는 경로(브라우저 접속,
 * 알림 거부)에서도 결과가 닿아야 하기 때문이다.
 *
 * 친구 요청 다이얼로그(F0-3)와 자리가 겹친다. `MarkerDialog` 는 네이티브 `<dialog>` +
 * `showModal()` 을 쓰는데, 동시에 열리는 모달들은 top layer 에 showModal() 호출 순서로
 * 쌓인다 — DOM 순서가 아니라 호출 순서다. 두 워처가 같은 커밋에서 함께 마운트되면
 * "나중에 호출한 쪽"이 위로 온다. 그래서 레이아웃의 DOM 순서(이 컴포넌트가 먼저)만으로는
 * 이 다이얼로그가 위에 뜨는 걸 보장하지 못한다 — 실제 우선순위는
 * FriendRequestWatcher 쪽에서 `settlementPending` 을 받아 안 본 결과가 있는 동안
 * 자기 다이얼로그를 열지 않는 방식으로 강제한다.
 */
export function SettlementWatcher({ result }: { result: UnseenResult | null }) {
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  const [pending, startTransition] = useTransition();

  function close(then?: () => void) {
    setClosed(true);
    startTransition(async () => {
      await markResultsSeenAction();
      router.refresh();
      then?.();
    });
  }

  if (!result) return null;
  const primary = result.primaryTitleId ? TITLE_BY_ID[result.primaryTitleId] : null;

  return (
    <MarkerDialog
      open={!closed}
      onClose={() => close()}
      title="어제의 결과가 나왔어요"
      actions={
        <>
          <MarkerButton size="sm" variant="ghost" disabled={pending} onClick={() => close()}>
            닫기
          </MarkerButton>
          <MarkerButton
            size="sm"
            disabled={pending}
            onClick={() => close(() => router.push(`/records/${result.date}`))}
          >
            기록 보기
          </MarkerButton>
        </>
      }
    >
      <p className="font-note text-lg text-pencil">{kstDateLabel(result.date)}</p>
      <div className="mt-2 flex items-center gap-3">
        <Stickman pose={primary?.pose ?? "stand"} size={40} thick />
        <span className="min-w-0">
          <span className="block font-ui text-[22px] font-bold leading-tight text-balance">
            {primary ? primary.name : "칭호 없음"}
          </span>
          <span className="tabular block font-note text-lg text-pencil">
            {result.total.toLocaleString("ko-KR")}번 · {result.rank}위 / {result.rankTotal}명 · 칭호{" "}
            {result.titleCount}개
          </span>
        </span>
      </div>
    </MarkerDialog>
  );
}
