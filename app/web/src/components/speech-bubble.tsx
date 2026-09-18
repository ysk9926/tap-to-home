import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type SpeechBubbleProps = ComponentPropsWithoutRef<"span"> & {
  /** 꼬리 방향. 기본은 아래 왼쪽 (레이스에서 졸라맨 머리 위에 붙일 때) */
  tail?: "bottom-left" | "bottom-right" | "none";
};

/** 연필 선 말풍선. "거의 다 왔어!" 같은 짧은 한마디 */
export function SpeechBubble({
  tail = "bottom-left",
  className,
  children,
  ...props
}: SpeechBubbleProps) {
  return (
    <span
      className={cn(
        "relative inline-block whitespace-nowrap bg-paper px-2.5 py-0.5",
        "font-note text-base text-ink border-[1.5px] border-pencil rounded-bubble",
        tail !== "none" &&
          "after:absolute after:-bottom-[6px] after:h-2 after:w-2 after:rotate-45 after:bg-paper after:border-r-[1.5px] after:border-b-[1.5px] after:border-pencil",
        tail === "bottom-left" && "after:left-5",
        tail === "bottom-right" && "after:right-5",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
