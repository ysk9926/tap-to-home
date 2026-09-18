import { Stickman, type StickmanPose } from "./stickman";
import { cn } from "@/lib/cn";

type TitleBadgeProps = {
  /** 칭호 이름. 두 줄까지 */
  name: string;
  pose: StickmanPose;
  /** 미획득. 실루엣 + 힌트만 보여준다 (F3-2) */
  locked?: boolean;
  hint?: string;
  /** 오늘 새로 얻음 */
  isNew?: boolean;
  className?: string;
};

/** 퇴근 도감의 칭호 한 칸 */
export function TitleBadge({
  name,
  pose,
  locked = false,
  hint,
  isNew = false,
  className,
}: TitleBadgeProps) {
  return (
    <div
      className={cn(
        "mk relative flex aspect-[1/1.05] flex-col items-center justify-center gap-1 p-1.5 text-center text-[13px] leading-[1.1]",
        locked && "mk-dashed bg-transparent text-pencil-soft",
        className,
      )}
    >
      {isNew && (
        <span className="absolute -top-2.5 -right-2 rotate-6 rounded-full border-[1.5px] border-marker bg-hilite-2 px-1.5 font-note text-sm text-ink">
          NEW
        </span>
      )}
      <Stickman pose={pose} size={28} className={cn(locked && "opacity-25")} />
      {locked ? (
        <>
          <span>? ? ?</span>
          {hint && <span className="font-note text-xs">{hint}</span>}
        </>
      ) : (
        <span className="text-balance">{name}</span>
      )}
    </div>
  );
}
