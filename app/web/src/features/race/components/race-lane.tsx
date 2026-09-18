import { CrownIcon, HouseIcon } from "@/components/icons";
import { SpeechBubble } from "@/components/speech-bubble";
import { Stickman } from "@/components/stickman";
import { cn } from "@/lib/cn";
import { STAGES, progressOf, stageOf } from "../stages";

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

const TICK_STAGES = STAGES.filter((s) => s.key !== "elevator");

/** 레인 위에 놓는 단계 눈금 (회사 … 집). RaceLane 과 같은 3칸 그리드라 트랙과 정렬된다 */
export function StageTicks({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-[30px] shrink-0 grid-cols-[86px_1fr_28px]",
        className,
      )}
    >
      <div />
      <div className="relative">
        {/* 트랙이 좁아 0%·10% 눈금이 겹치므로 엘리베이터는 생략 */}
        {TICK_STAGES.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "absolute whitespace-nowrap font-note text-sm text-pencil-soft",
              i === 0
                ? "translate-x-0"
                : i === TICK_STAGES.length - 1
                  ? "-translate-x-full"
                  : "-translate-x-1/2",
            )}
            style={{ left: `${s.threshold}%` }}
          >
            {i === 0 ? "회사" : s.short}
          </span>
        ))}
      </div>
      <div />
    </div>
  );
}
