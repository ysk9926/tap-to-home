import { HouseIcon } from "@/components/icons";
import { Stickman } from "@/components/stickman";
import { cn } from "@/lib/cn";
import { STAGES, progressOf, stageOf } from "../stages";

type StageStripProps = {
  count: number;
  /** 걷기 프레임. 탭할 때마다 0/1 토글 */
  frame?: 0 | 1;
  name?: string;
  className?: string;
};

/** 메인 화면의 자리→집 진행 바. 내 졸라맨 하나만 올라간다 */
export function StageStrip({ count, frame = 0, name = "나", className }: StageStripProps) {
  const stage = stageOf(count);
  const pct = progressOf(count);

  return (
    <div className={cn("relative h-[78px] shrink-0", className)}>
      <div className="absolute inset-x-0 bottom-5 border-t-[1.5px] border-pencil" />
      {STAGES.map((s) => (
        <div
          key={s.key}
          className={cn(
            "absolute bottom-3 -translate-x-1/2 whitespace-nowrap font-note text-[15px]",
            "before:mx-auto before:mb-0.5 before:block before:h-2.5 before:w-0 before:border-l-[1.5px] before:border-pencil",
            count >= s.threshold ? "text-pencil" : "text-pencil-soft",
          )}
          style={{ left: `${s.threshold}%` }}
        >
          {s.short}
        </div>
      ))}
      <HouseIcon size={26} className="absolute -right-1.5 bottom-[22px] text-marker" />
      <div
        className="absolute bottom-[21px] -translate-x-1/2 transition-[left] duration-200 ease-[steps(3)]"
        style={{ left: `${pct}%` }}
      >
        <div className="absolute left-1/2 -top-[22px] -translate-x-1/2 whitespace-nowrap font-note text-base">
          {name}
        </div>
        <Stickman pose={stage.pose} size={40} frame={frame} />
      </div>
    </div>
  );
}
