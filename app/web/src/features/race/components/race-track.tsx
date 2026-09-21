"use client";

import { Stickman } from "@/components/stickman";
import { SpeechBubble } from "@/components/speech-bubble";
import { cn } from "@/lib/cn";
import { useRaceMotion } from "../hooks/use-race-motion";
import { STAGES, stageOf } from "../stages";
import { RaceScene, SCENE_CAPTIONS } from "./race-scene";
import { landmarkPositionOf, trackPositionOf } from "./track-layout";

/** One rail, six fixed landmarks and one occupant, shared by the main screen and rankings. */
export function RaceTrack({ count, frame = 0, compact = false, name, bubble, inactive = false, className }: {
  count: number;
  frame?: 0 | 1;
  compact?: boolean;
  name?: string;
  bubble?: string;
  inactive?: boolean;
  className?: string;
}) {
  const motion = useRaceMotion(count);
  const running = motion && !inactive;
  const current = stageOf(count);
  const size = compact ? 24 : 36;
  const railBottom = compact ? 6 : 21;
  const personSize = size * 60 / 72;
  /*
   * 출발할 때만 레일 위를 달린다. 시작점은 지금 서 있던 랜드마크 안이라
   * 문이 열리는 자리에서 그대로 뛰쳐나오는 것으로 읽힌다. 도착점은 다음 랜드마크가
   * 아니라 현재 누적 위치이고, 800ms 뒤 useRaceMotion 이 꺼지면 다시 랜드마크 대기로 돌아간다.
   */
  const origin = trackPositionOf(current.threshold, size);
  const position = running ? trackPositionOf(count, size) : origin;

  return <div role="group" aria-label="퇴근 경로" className={cn("relative min-w-0 shrink-0", compact ? "h-16" : "h-24", className)}>
    <div
      data-rail="true"
      className={cn("absolute inset-x-0 border-t-[1.5px]", compact ? "border-dashed border-pencil-soft" : "border-pencil")}
      style={{ bottom: railBottom }}
    />
    {STAGES.map((stage, index) => {
      const active = current.key === stage.key;
      return <div key={stage.key}>
        <div className="absolute" style={{ left: landmarkPositionOf(index, size), bottom: railBottom - size * 5 / 72 }}>
          <RaceScene
            count={stage.threshold}
            running={active && running}
            occupied={active && !running}
            frame={frame}
            size={size}
            className={cn(inactive ? "opacity-35" : count < stage.threshold ? "opacity-35" : "opacity-100")}
          />
        </div>
        {!compact && <span
          className="absolute bottom-0 whitespace-nowrap text-center font-note text-[15px] leading-[21px]"
          style={{ left: landmarkPositionOf(index, size), width: size * 1.5 }}
        >{stage.short}</span>}
      </div>;
    })}
    {/* Keep exact progress visible while the person waits at the reached landmark. */}
    <span
      aria-hidden="true"
      className="absolute h-1 w-1 -translate-x-1/2 rounded-full bg-pencil transition-[left] duration-200 ease-[steps(3)]"
      style={{ left: trackPositionOf(count, size), bottom: railBottom - 1 }}
    />
    {/* Keep the position wrapper mounted so the first tap can move from the idle spot. */}
    <div
      role={running ? "img" : undefined} aria-label={running ? SCENE_CAPTIONS[current.key][1] : undefined}
      aria-hidden={!running}
      className="pointer-events-none absolute -translate-x-1/2 transition-[left] duration-700 ease-[steps(6)]"
      style={{ left: position, bottom: railBottom - personSize * 6 / 60, width: personSize * 40 / 60, height: personSize }}
    >
      {running && <>
        <div className="race-run-first absolute inset-0"><Stickman pose="run" size={personSize} frame={0} /></div>
        <div className="race-run-second absolute inset-0"><Stickman pose="run" size={personSize} frame={1} /></div>
      </>}
    </div>
    {(name || bubble) && <div
      className="absolute flex w-28 max-w-full -translate-x-1/2 justify-center font-note text-base transition-[left] duration-200 ease-[steps(3)]"
      style={{ left: `clamp(56px, ${position}, calc(100% - 56px))`, bottom: railBottom + size + 2 }}
    >{bubble ? <SpeechBubble className="max-w-full whitespace-normal">{bubble}</SpeechBubble> : <span className="truncate" title={name}>{name}</span>}</div>}
  </div>;
}
