"use client";

import { useEffect, useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { Stickman, STICKMAN_POSES, type StickmanPose } from "@/components/stickman";
import { TapButton } from "@/components/tap-button";
import { StageStrip } from "@/features/race/components/stage-strip";
import { RaceLane } from "@/features/race/components/race-lane";
import { RaceScene } from "@/features/race/components/race-scene";
import { HOME_THRESHOLD, STAGES, stageOf } from "@/features/race/stages";

/** 탭 카운트와 걷기 프레임을 한 곳에서 관리하는 훅. 데모용 */
function useTapCounter(initial: number) {
  const [count, setCount] = useState(initial);
  const [frame, setFrame] = useState<0 | 1>(0);
  const tap = () => {
    setCount((c) => Math.min(c + 1, HOME_THRESHOLD));
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
          {count >= HOME_THRESHOLD ? "오늘은 침대에서 푹 쉬어요" : done ? "정산 후 · 점선" : "꾹꾹 누르면 한 칸씩 간다"}
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
          <MarkerButton size="sm" variant="ghost" onClick={() => setCount(9999)}>마지막 1회 남기기</MarkerButton>
          <MarkerButton size="sm" variant="ghost" onClick={() => setDone((d) => !d)}>
            {done ? "다시 활성화" : "정산 상태 보기"}
          </MarkerButton>
        </div>
      </div>
    </div>
  );
}

export function RaceSceneSheet() {
  return <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
    {STAGES.map((stage) => <div key={stage.key} className="font-note text-lg">
      <p>{stage.label} · {stage.threshold.toLocaleString()}회</p>
      <StageStrip count={stage.threshold} name="나" />
      <RaceLane rank={1} name="나" count={stage.threshold} className="mb-4" />
      <div className="mt-2 flex flex-wrap gap-4">
        <div><RaceScene count={stage.threshold} size={72} /><p>대기</p></div>
        {stage.key !== "home" && <div><RaceScene count={stage.threshold} running size={72} /><p>탭하면 달리기</p></div>}
      </div>
    </div>)}
  </div>;
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
        <span className="font-note text-lg text-pencil-soft">내 레인만 움직인다</span>
      </div>
    </div>
  );
}
