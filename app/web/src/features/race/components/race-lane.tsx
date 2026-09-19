import { CrownIcon, HouseIcon } from "@/components/icons";
import { SpeechBubble } from "@/components/speech-bubble";
import { Stickman } from "@/components/stickman";
import { cn } from "@/lib/cn";
import { STAGES, progressOf, stageOf } from "../stages";
import { StageLandmark } from "./stage-landmark";

/**
 * 트랙 위 눈금. 양 끝은 뺀다 — 자리(0%)는 졸라맨 출발점이라 이름 칸과 겹치고,
 * 집(100%)은 레인 오른쪽 칸의 HouseIcon 이 이미 보여준다.
 */
const TICK_STAGES = STAGES.filter((s) => s.key !== "seat" && s.key !== "home");

type RaceLaneProps = {
  rank: number;
  name: string;
  count: number;
  /** 내 레인이면 이름에 형광펜 */
  isMe?: boolean;
  /** 오늘 아직 안 들어온 친구 */
  inactive?: boolean;
  frame?: 0 | 1;
  /** 머리 위 말풍선 */
  bubble?: string;
  className?: string;
};

/**
 * 친구 레이스의 한 줄. 높이 64px = 줄노트 두 칸이라 배경 줄과 발이 맞물린다.
 * 랭킹·이름·횟수 / 트랙 / 집 아이콘 세 칸.
 * 트랙에는 단계 랜드마크(자리 … 지하철)가 점선 위에 옅게 서 있고 졸라맨이 그 앞을 지나간다.
 */
export function RaceLane({
  rank,
  name,
  count,
  isMe = false,
  inactive = false,
  frame = 0,
  bubble,
  className,
}: RaceLaneProps) {
  const stage = stageOf(count);
  const pct = inactive ? 1 : progressOf(count);

  return (
    <div
      className={cn(
        "grid h-[64px] shrink-0 grid-cols-[86px_1fr_28px] items-end",
        className,
      )}
    >
      <div className="pb-1.5 leading-none">
        <div className="font-note text-sm text-pencil-soft">
          {rank}위{" "}
          {rank === 1 && (
            <CrownIcon size={14} className="inline -mb-px text-marker" />
          )}
        </div>
        <div className="whitespace-nowrap text-lg font-bold">
          <span className={cn(isMe && "hl")}>{name}</span>
        </div>
        <div className="tabular whitespace-nowrap text-[15px] text-pencil">
          {count}번 · {inactive ? "안 옴" : stage.short}
        </div>
      </div>

      <div className="relative h-[64px]">
        <div className="absolute inset-x-0 bottom-[5px] border-t-[1.5px] border-dashed border-pencil-soft opacity-55" />
        {TICK_STAGES.map((s) => (
          <StageLandmark
            key={s.key}
            stage={s.key}
            size={18}
            className={cn(
              "absolute bottom-[5px] -translate-x-1/2 text-pencil-soft",
              count >= s.threshold ? "opacity-70" : "opacity-40",
            )}
            style={{ left: `${progressOf(s.threshold)}%` }}
          />
        ))}
        {bubble && (
          <div
            className="absolute bottom-[52px] -translate-x-[30%]"
            style={{ left: `${pct}%` }}
          >
            <SpeechBubble>{bubble}</SpeechBubble>
          </div>
        )}
        <div
          className="absolute bottom-1.5 -translate-x-1/2 transition-[left] duration-300 ease-[steps(3)]"
          style={{ left: `${pct}%` }}
        >
          <Stickman
            pose={inactive ? "stand" : stage.pose}
            size={40}
            frame={frame}
            className={cn(inactive && "opacity-35")}
          />
        </div>
      </div>

      <HouseIcon size={24} className="mb-1 text-marker" />
    </div>
  );
}
