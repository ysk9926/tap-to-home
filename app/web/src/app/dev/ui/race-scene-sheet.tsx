"use client";

import { useEffect, useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { RaceLane } from "@/features/race/components/race-lane";
import { RaceScene, SCENE_CAPTIONS } from "@/features/race/components/race-scene";
import { StageStrip } from "@/features/race/components/stage-strip";
import { STAGES, type Stage } from "@/features/race/stages";

export function RaceSceneSheet() {
  const [repeating, setRepeating] = useState(false);
  const [departing, setDeparting] = useState(false);

  useEffect(() => {
    if (!repeating) return;
    const timer = setTimeout(() => setDeparting(!departing), departing ? 800 : 1000);
    return () => clearTimeout(timer);
  }, [repeating, departing]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <MarkerButton
          size="sm"
          aria-pressed={repeating}
          onClick={() => {
            setRepeating(!repeating);
            setDeparting(!repeating);
          }}
        >
          {repeating ? "전체 반복 멈추기" : "전체 반복 재생"}
        </MarkerButton>
        <p className="font-note text-lg text-pencil-soft">
          출발 0.8초 → 대기 1초 · 집에서는 계속 쉬어요
        </p>
      </div>
      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage, index) => (
          <RaceScenePreview
            key={stage.key}
            stage={stage}
            nextThreshold={STAGES[index + 1]?.threshold ?? stage.threshold}
            repeating={repeating}
            departing={departing}
          />
        ))}
      </div>
    </div>
  );
}

function RaceScenePreview({ stage, nextThreshold, repeating, departing }: {
  stage: Stage;
  nextThreshold: number;
  repeating: boolean;
  departing: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const home = stage.key === "home";
  const running = !home && (repeating ? departing : playing);
  // Move visibly within this stage, without crossing into the next preview.
  const count = stage.threshold + (running ? Math.floor((nextThreshold - stage.threshold) / 3) : 0);
  /*
   * 아래 두 줄은 실제 RaceTrack 이다. RaceTrack 은 count 가 늘어날 때 useRaceMotion 이
   * 출발을 잡으므로, 확대 장면이 대기로 돌아가면 count 도 같이 임계값으로 되돌려
   * 다음 재생에서 다시 증가로 읽히게 한다. docs/design.md 의 "확대 장면과 실제 레일은
   * 같은 상태로 움직인다" 를 지키는 부분.
   */

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setPlaying(false), 800);
    return () => clearTimeout(timer);
  }, [playing]);

  return (
    <article aria-labelledby={`scene-${stage.key}`} className="min-w-0 border-t border-dashed border-pencil-soft pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={`scene-${stage.key}`} className="text-2xl font-bold">{stage.label}</h3>
        <span className="tabular font-note text-lg text-pencil-soft">
          {stage.threshold.toLocaleString("ko-KR")}회부터
        </span>
      </div>
      <div className="flex h-44 items-center justify-center" aria-label={`${stage.label} 확대 미리보기`}>
        <RaceScene count={stage.threshold} running={running} size={128} />
      </div>
      <p className="min-h-14 text-center font-note text-xl text-pencil">
        <span className="block text-base text-pencil-soft">{home ? "퇴근 완료" : running ? "출발" : "대기"}</span>
        {SCENE_CAPTIONS[stage.key][running ? 1 : 0]}
      </p>
      <div className="mt-3 flex justify-center">
        <MarkerButton
          size="sm"
          disabled={home || repeating || playing}
          aria-label={`${stage.label} ${home ? "퇴근 완료" : "출발 한 번 재생"}`}
          onClick={() => setPlaying(true)}
        >
          {home ? "집에서는 쉬는 중" : repeating ? "전체 반복 재생 중" : playing ? "출발하는 중…" : "출발 한 번 재생"}
        </MarkerButton>
      </div>
      <p className="mt-5 font-note text-base text-pencil-soft">실제 화면 크기 · 메인 / 랭킹</p>
      <StageStrip count={count} name="나" />
      <RaceLane rank={1} name="나" count={count} />
    </article>
  );
}
