import { CrownIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { stageOf } from "../stages";
import { RaceTrack } from "./race-track";

type RaceLaneProps = {
  rank: number;
  name: string;
  count: number;
  isMe?: boolean;
  inactive?: boolean;
  frame?: 0 | 1;
  bubble?: string;
  className?: string;
};

/** Ranking details and one rail with every landmark, including the destination house. */
export function RaceLane({ rank, name, count, isMe = false, inactive = false, frame = 0, bubble, className }: RaceLaneProps) {
  const stage = stageOf(count);
  return <div className={cn("grid h-16 shrink-0 grid-cols-[86px_minmax(0,1fr)] items-end", className)}>
    <div className="pb-1.5 leading-none">
      <div className="font-note text-sm text-pencil-soft">
        {rank}위{" "}
        {rank === 1 && <CrownIcon size={14} className="inline -mb-px text-marker" />}
      </div>
      <div className="truncate text-lg font-bold" title={name}>
        <span className={cn(isMe && "hl")}>{name}</span>
      </div>
      <div className="tabular truncate text-[15px] text-pencil" title={`${count}번 · ${inactive ? "안 옴" : stage.short}`}>
        {count}번 · {inactive ? "안 옴" : stage.short}
      </div>
    </div>
    <RaceTrack count={inactive ? 0 : count} frame={frame} compact inactive={inactive} bubble={bubble} />
  </div>;
}
