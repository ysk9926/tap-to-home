"use client";

import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { useRaceSession } from "../hooks/use-race-session";
import type { RaceToday } from "../race-state";
import { RaceLane } from "./race-lane";

/**
 * 오늘의 퇴근 레이스 랭킹 (F1-2). 내 레인은 상단에 고정하고 친구 레인만 스크롤한다 —
 * 친구가 몇 명이든 내 순위가 화면에서 밀려나지 않게. 탭 버튼은 `/` 에만 있다.
 */
export function RankingScreen({ initial }: { initial: RaceToday }) {
  const { data, connected } = useRaceSession(initial);
  const myRank = data.racers.findIndex((r) => r.isMe) + 1;
  const friends = data.racers.filter((r) => !r.isMe);

  // overflow-hidden: 레이아웃의 스크롤 컨테이너 안에서 이 화면은 자기 높이를 넘지 않고,
  // 스크롤은 아래 친구 목록만 갖는다
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-end justify-between">
        <div>
          <ScreenTitle>오늘의 퇴근 레이스</ScreenTitle>
          <Note>누가 먼저 집에 갈까</Note>
        </div>
        <span className="inline-flex items-center gap-1.5 font-note text-[17px] text-pencil">
          <i className="h-2 w-2 animate-pulse rounded-full bg-marker" />
          {connected ? "실시간" : "2초마다 갱신"}
        </span>
      </div>

      {/* 내 레인 — 고정. 아래 목록이 스크롤돼도 남는다 */}
      <div className="mt-4 shrink-0 border-b-[3px] border-marker pb-2">
        <RaceLane rank={myRank} name={data.me.name} count={data.me.tapCount} isMe />
      </div>

      {friends.length === 0 ? (
        <Note className="mt-4">
          아직 친구가 없어요.{" "}
          <Link href="/friends" className="underline underline-offset-4">
            아이디로 친구 등록하기
          </Link>
        </Note>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3">
          {friends.map((r) => (
            <RaceLane
              key={r.userId}
              rank={data.racers.findIndex((x) => x.userId === r.userId) + 1}
              name={r.name}
              count={r.tapCount}
            />
          ))}
        </div>
      )}

    </div>
  );
}
