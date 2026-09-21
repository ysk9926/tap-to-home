"use client";

import { useEffect, useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { Stickman, STICKMAN_POSES, type StickmanPose } from "@/components/stickman";
import { TapButton } from "@/components/tap-button";
import { FriendRailsSwitch } from "@/features/auth/components/friend-rails-switch";
import { StageStrip } from "@/features/race/components/stage-strip";
import { RaceLane } from "@/features/race/components/race-lane";
import { HOME_THRESHOLD, STAGES, stageIndexOf, stageOf } from "@/features/race/stages";

export function FriendRailsSwitchDemo() {
  return (
    <div className="grid max-w-[720px] gap-6 sm:grid-cols-2">
      <FriendRailsSwitchExample initial />
      <FriendRailsSwitchExample initial={false} />
      <FriendRailsSwitchExample initial fail />
    </div>
  );
}

function FriendRailsSwitchExample({ initial, fail = false }: { initial: boolean; fail?: boolean }) {
  const [saved, setSaved] = useState(initial);
  return (
    <div>
      <p className="font-note text-lg text-pencil">{fail ? "저장 실패 · 눌러서 복원 확인" : "눌러서 저장 중 상태 확인"}</p>
      <FriendRailsSwitch showTopFriendRails={saved} saveAction={async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (fail) throw new Error("Preview save failure");
        setSaved(data.get("showTopFriendRails") === "on");
      }} />
    </div>
  );
}

/**
 * 탭 카운트와 걷기 프레임을 한 곳에서 관리하는 훅. 데모용.
 *
 * 실제 게임은 한 구간이 750~1350 탭이라 한 번 눌러서는 레일이 0.02% 밖에 안 움직인다.
 * 레퍼런스 페이지에서는 눌렀을 때 달려 나가는 모습이 보여야 하므로, 현재 구간 길이의
 * 1/12 씩 전진시켜 열두 번쯤 누르면 다음 랜드마크에 닿게 한다. stages.ts 의 임계값은
 * 그대로 두고 입력만 배속한다.
 */
const DEMO_TAPS_PER_STAGE = 12;

function useTapCounter(initial: number) {
  const [count, setCount] = useState(initial);
  const [frame, setFrame] = useState<0 | 1>(0);
  const tap = () => {
    setCount((c) => {
      const index = stageIndexOf(c);
      const here = STAGES[index].threshold;
      const next = STAGES[Math.min(index + 1, STAGES.length - 1)].threshold;
      const stride = Math.max(1, Math.round((next - here) / DEMO_TAPS_PER_STAGE));
      return Math.min(c + stride, HOME_THRESHOLD);
    });
    setFrame((f) => (f === 0 ? 1 : 0));
  };
  return { count, frame, tap, setCount, reset: () => setCount(initial) };
}

/** 메인 버튼 + 진행 바가 실제로 연동되는 데모 */
export function TapDemo() {
  const { count, frame, tap, setCount, reset } = useTapCounter(0);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex flex-col items-center gap-2">
        <TapButton onTap={tap} disabled={done} completed={count >= HOME_THRESHOLD} />
        <p className="font-note text-lg text-pencil-soft">
          {count >= HOME_THRESHOLD ? "오늘은 침대에서 푹 쉬어요" : done ? "정산 후 · 점선" : `누르면 달려 나간다 · 구간당 ${DEMO_TAPS_PER_STAGE}번`}
        </p>
      </div>
      <div className="min-w-[300px] flex-1">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-[64px] font-bold leading-none">{count}</span>
          <span className="text-2xl font-bold">번</span>
          <span className="ml-2 font-note text-xl text-pencil">
            지금 {stageOf(count).label}
          </span>
        </div>
        <StageStrip count={count} frame={frame} className="mt-4" />
        <RaceLane rank={1} name="나" count={count} frame={frame} className="mt-6" />
        <label className="mt-4 block font-note text-lg">
          이동 미리보기 · {count}회
          <input
            type="range"
            min={0}
            max={STAGES[STAGES.length - 1].threshold}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="block w-full accent-pencil"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <MarkerButton size="sm" onClick={reset}>
            자리에 앉기 · 0회
          </MarkerButton>
          <MarkerButton size="sm" variant="ghost" onClick={() => setCount(STAGES[1].threshold / 2)}>
            이동 중 보기
          </MarkerButton>
          {STAGES.slice(1).map((stage) => <MarkerButton key={stage.key} size="sm" variant="ghost" onClick={() => setCount(stage.threshold)}>
            {stage.short} 도착 보기
          </MarkerButton>)}
          <MarkerButton size="sm" variant="ghost" onClick={() => setCount(HOME_THRESHOLD - 1)}>마지막 1회 남기기</MarkerButton>
          <MarkerButton size="sm" variant="ghost" onClick={() => setDone((d) => !d)}>
            {done ? "다시 활성화" : "정산 상태 보기"}
          </MarkerButton>
        </div>
      </div>
    </div>
  );
}

/** 6포즈 + 2프레임 스톱모션 재생 */
export function StickmanSheet() {
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 380);
    return () => clearInterval(id);
  }, [playing]);

  const poses = Object.keys(STICKMAN_POSES) as StickmanPose[];
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
        {poses.map((pose) => {
          const stage = STAGES.find((s) => s.pose === pose);
          return (
            <div key={pose} className="text-center font-note text-lg text-pencil">
              <div className="flex h-[80px] items-end justify-center">
                <Stickman pose={pose} size={56} frame={frame} />
              </div>
              <div>{stage ? stage.label : "누움"}</div>
              <div className="text-sm text-pencil-soft">
                {stage ? `${stage.threshold}회` : "결과 카드"}{" "}
                <code className="font-mono text-[11px]">{pose}</code>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <MarkerButton size="sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? "멈춤" : "2프레임 재생"}
        </MarkerButton>
        <MarkerButton size="sm" variant="ghost" onClick={() => setFrame((f) => (f === 0 ? 1 : 0))}>
          한 프레임 넘기기
        </MarkerButton>
        <span className="font-note text-lg text-pencil-soft">frame = {frame}</span>
      </div>
    </div>
  );
}

/** 레이스 레인: 내 레인만 탭으로 움직여 본다 */
export function RaceDemo() {
  const { count, frame, tap } = useTapCounter(23);
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="w-[320px] shrink-0 pt-8">
        <RaceLane rank={1} name="민경" count={253} bubble="거의 다 왔어!" />
        <RaceLane rank={2} name="수현" count={160} />
        <RaceLane rank={3} name="나" count={count} isMe frame={frame} />
        <RaceLane rank={4} name="지영" count={9} bubble="아직 멀어…" />
        <RaceLane rank={5} name="도윤" count={0} inactive />
      </div>
      <div className="flex flex-col items-center gap-2">
        <TapButton onTap={tap} size={160} completed={count >= HOME_THRESHOLD} />
        <span className="font-note text-lg text-pencil-soft">내 레인만 움직인다 · 누르면 출발</span>
      </div>
    </div>
  );
}
