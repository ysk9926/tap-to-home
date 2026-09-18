import type { ReactNode } from "react";
import { BellIcon } from "./icons";
import { cn } from "@/lib/cn";

export type SignalLevel = "normal" | "strong" | "urgent" | "rescue";

type SignalToastProps = {
  level: SignalLevel;
  /** 본문. 이름·등급을 <b> 로 감싸 강조 */
  children: ReactNode;
  /** "10연타 · 방금" 같은 부가 정보 */
  meta?: string;
  className?: string;
};

/**
 * 퇴근 신호 토스트 (F2). urgent 이상은 형광펜 바탕으로 눈에 띄게.
 * 등급별 문구는 features/signal 에서 만든다. 여기는 껍데기만.
 */
export function SignalToast({ level, children, meta, className }: SignalToastProps) {
  const hot = level === "urgent" || level === "rescue";
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-sketch",
        hot ? "bg-hilite" : "mk",
        className,
      )}
    >
      <BellIcon size={30} className="shrink-0 text-marker" />
      <div className="text-[17px] leading-tight">
        <div>{children}</div>
        {meta && <div className="font-note text-base text-pencil">{meta}</div>}
      </div>
    </div>
  );
}
