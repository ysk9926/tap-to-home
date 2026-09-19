"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { TapButton } from "@/components/tap-button";
import { COMBO_WINDOW_MS, createComboTracker } from "@/features/signal/combo";
import { SignalToastLayer } from "@/features/signal/components/signal-toast-layer";
import { useSignalToasts } from "@/features/signal/hooks/use-signal-toasts";
import { fetchJson } from "@/lib/fetch-json";
import { kstDateLabel } from "@/lib/kst";
import { useRaceToday } from "../hooks/use-race-today";
import { useTap } from "../hooks/use-tap";
import type { RaceToday } from "../race-state";
import { stageOf } from "../stages";
import { RaceLane, StageTicks } from "./race-lane";
import { StageStrip } from "./stage-strip";

export function RaceScreen({ initial }: { initial: RaceToday }) {
  const { data } = useRaceToday(initial, { polling: true });
  const { toasts } = useSignalToasts({ polling: true });

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

  const { tap, frame } = useTap({ onTap });
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

      <SignalToastLayer toasts={toasts} />
    </div>
  );
}
