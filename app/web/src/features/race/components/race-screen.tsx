"use client";

import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { TapButton } from "@/components/tap-button";
import { kstDateLabel } from "@/lib/kst";
import { useRaceToday } from "../hooks/use-race-today";
import { useTap } from "../hooks/use-tap";
import type { RaceToday } from "../race-state";
import { stageOf } from "../stages";
import { RaceLane, StageTicks } from "./race-lane";
import { StageStrip } from "./stage-strip";

export function RaceScreen({ initial }: { initial: RaceToday }) {
  const { data } = useRaceToday(initial, { polling: true });
  const { tap, frame } = useTap();
  const me = data.me;
  const friends = data.racers.filter((r) => !r.isMe);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
      <Note>
        {kstDateLabel(data.date)} · {data.settled ? "정산 완료" : `아직 ${stageOf(me.tapCount).label}`}
      </Note>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="tabular text-[88px] font-bold leading-[.9] tracking-tight">{me.tapCount}</span>
        <span className="text-[26px] font-bold">번</span>
      </div>

      <StageStrip count={me.tapCount} frame={frame} name={me.name} className="mt-4" />

      <div className="mt-3 flex flex-col items-center">
        <TapButton onTap={tap} disabled={data.settled} />
        <p className="mt-2 font-note text-[19px] text-pencil-soft">
          {data.settled ? (
            <Link href="/today" className="underline underline-offset-4">
              오늘은 정산했어요 · 결과 보기
            </Link>
          ) : (
            "꾹꾹 누르면 한 칸씩 간다"
          )}
        </p>
      </div>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <ScreenTitle className="text-[22px]">오늘의 퇴근 레이스</ScreenTitle>
            <Note>누가 먼저 집에 갈까</Note>
          </div>
          <span className="inline-flex items-center gap-1.5 font-note text-[17px] text-pencil">
            <i className="h-2 w-2 animate-pulse rounded-full bg-marker" />
            2초마다 갱신
          </span>
        </div>

        {friends.length === 0 ? (
          <Note className="mt-4">
            아직 친구가 없어요.{" "}
            <Link href="/friends" className="underline underline-offset-4">
              아이디로 친구 등록하기
            </Link>
          </Note>
        ) : (
          <>
            <StageTicks className="mt-2" />
            {data.racers.map((r, i) => (
              <RaceLane
                key={r.userId}
                rank={i + 1}
                name={r.name}
                count={r.tapCount}
                isMe={r.isMe}
                frame={r.isMe ? frame : 0}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
