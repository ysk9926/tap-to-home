"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { TapButton } from "@/components/tap-button";
import { COMBO_WINDOW_MS, createComboTracker } from "@/features/signal/combo";
import { fetchJson } from "@/lib/fetch-json";
import { kstDateLabel } from "@/lib/kst";
import { useRaceSession } from "../hooks/use-race-session";
import { useTap } from "../hooks/use-tap";
import type { RaceToday } from "../race-state";
import { HOME_THRESHOLD, stageOf } from "../stages";
import { StageStrip } from "./stage-strip";

export function RaceScreen({ initial }: { initial: RaceToday }) {
  const { data } = useRaceSession(initial);

  // 연타 감지: 탭마다 창을 다시 열고, 창이 닫히면 최고 등급 하나만 보낸다 (F2)
  // 트래커 자체는 리렌더를 유발할 필요가 없는 안정적인 싱글턴이라 setter 는 쓰지 않는다.
  // useRef(createComboTracker()) 는 매 렌더 인자를 만들고 react-hooks/refs 는 렌더 중
  // ref.current 를 지연 초기화용으로 읽는 것도 금지하므로, 지연 초기화가 허용되는
  // useState 초기화 함수로 한 번만 만든다.
  const [combo] = useState(() => createComboTracker());
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = useCallback((at: number) => {
    combo.tap(at);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      const level = combo.settle(Date.now());
      if (level) {
        void fetchJson("/api/signals", { method: "POST", body: JSON.stringify({ level }) }).catch(() => {});
      }
    }, COMBO_WINDOW_MS + 50);
  }, [combo]);
  useEffect(() => () => {
    if (comboTimer.current) clearTimeout(comboTimer.current);
  }, []);

  const { tap, frame } = useTap({ userId: initial.me.userId, date: data.date, onTap });
  const me = data.me;
  const completed = me.tapCount >= HOME_THRESHOLD;
  const myRank = data.racers.findIndex((r) => r.isMe) + 1;
  const friendCount = data.racers.length - 1;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
      <Note>
        {kstDateLabel(data.date)} · {completed ? "집 도착 · 퇴근 완료" : data.settled ? "정산 완료" : `아직 ${stageOf(me.tapCount).label}`}
      </Note>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="tabular text-[88px] font-bold leading-[.9] tracking-tight">{me.tapCount}</span>
        <span className="text-[26px] font-bold">번</span>
      </div>

      <StageStrip count={me.tapCount} frame={frame} name={me.name} className="mt-4" />

      <div className="mt-3 flex flex-col items-center">
        <TapButton onTap={tap} disabled={data.settled} completed={completed} />
        <p className="mt-2 font-note text-[19px] text-pencil-soft">
          {completed ? "오늘은 침대에서 푹 쉬어요" : data.settled ? "오늘은 정산했어요" : "꾹꾹 누르면 한 칸씩 간다"}
        </p>
        <Link
          href="/records"
          className="mt-3 font-note text-lg text-pencil underline underline-offset-4"
        >
          기록 보기
        </Link>
      </div>

      {/* 랭킹은 별도 탭이다 (F1-2) — 여기서는 한 줄로만 넘겨준다 */}
      <Link
        href={friendCount > 0 ? "/ranking" : "/friends"}
        className="mt-6 flex items-center justify-between gap-2 border-t-[1.5px] border-dashed border-pencil-soft pt-3"
      >
        <span className="min-w-0">
          <span className="block font-ui text-[22px] font-bold leading-tight">
            {friendCount > 0 ? "친구들은 어디쯤?" : "같이 달릴 친구가 없어요"}
          </span>
          <span className="block font-note text-[19px] text-pencil">
            {friendCount > 0 ? `나는 ${myRank}위` : "아이디로 친구 등록하기"}
          </span>
        </span>
        <span className="shrink-0 whitespace-nowrap font-note text-xl text-pencil-soft underline underline-offset-4">
          {friendCount > 0 ? "랭킹 →" : "친구 →"}
        </span>
      </Link>

    </div>
  );
}
