"use client";

import { cn } from "@/lib/cn";
import { STAGES } from "../stages";
import { useRaceMotion } from "../hooks/use-race-motion";
import { RaceScene } from "./race-scene";
import { StageLandmark } from "./stage-landmark";
import { RACER_SIZE, trackPositionOf } from "./track-layout";

type StageStripProps = {
  count: number;
  /** 걷기 프레임. 탭할 때마다 0/1 토글 */
  frame?: 0 | 1;
  name?: string;
  className?: string;
};

/** 양끝 랜드마크는 트랙 밖으로 나가지 않게 안쪽으로 붙인다 */
function edgeAlign(i: number, last: number) {
  return i === 0 ? "translate-x-0" : i === last ? "-translate-x-full" : "-translate-x-1/2";
}

/**
 * 메인 화면의 자리→집 진행 바. 현재 장면 아래에 고정 랜드마크와 이름표를 둔다.
 * 지나온 랜드마크는 연필색, 아직 못 간 곳은 연한 색. 집은 도착하면 매직색으로 진해진다.
 */
export function StageStrip({ count, frame = 0, name = "나", className }: StageStripProps) {
  const running = useRaceMotion(count);
  return (
    <div className={cn("relative h-32 shrink-0", className)}>
      <div className="absolute inset-x-0 bottom-5 border-t-[1.5px] border-pencil" />
      {STAGES.map((s, i) => {
        const reached = count >= s.threshold;
        const isHome = s.key === "home";
        return (
          <div
            key={s.key}
            className={cn(
              "absolute bottom-0 flex flex-col items-center",
              edgeAlign(i, STAGES.length - 1),
              reached ? "text-pencil" : "text-pencil-soft",
            )}
            style={{ left: s.key === "seat" ? 0 : trackPositionOf(s.threshold) }}
          >
            <StageLandmark
              stage={s.key}
              size={s.key === "seat" ? RACER_SIZE : isHome ? 34 : 30}
              className={cn(isHome && reached && "text-marker")}
            />
            <span className="h-[21px] whitespace-nowrap font-note text-[15px] leading-[21px]">{s.short}</span>
          </div>
        );
      })}
      <div
        className="absolute bottom-[54px] -translate-x-1/2 transition-[left] duration-200 ease-[steps(3)]"
        style={{ left: `clamp(48px, ${trackPositionOf(count)}, calc(100% - 48px))` }}
      >
        <div className="absolute left-1/2 -top-5 -translate-x-1/2 whitespace-nowrap font-note text-base">
          {name}
        </div>
        <RaceScene count={count} running={running} frame={frame} size={52} />
      </div>
    </div>
  );
}
