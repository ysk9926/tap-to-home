import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/cn";

type MarkerBoxProps<T extends ElementType> = {
  as?: T;
  /** box: 손그림 사각 · pill: 알약 · dashed: 잠금/비활성 점선 */
  variant?: "box" | "pill" | "dashed";
  /** 종이 그림자. 화면 위에 떠 있는 카드에만 */
  lifted?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

/** 매직 3px 로 그린 프레임. 카드·패널·뱃지의 바탕 */
export function MarkerBox<T extends ElementType = "div">({
  as,
  variant = "box",
  lifted = false,
  className,
  ...props
}: MarkerBoxProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={cn(
        "mk",
        variant === "pill" && "mk-pill",
        variant === "dashed" && "mk-dashed",
        lifted && "shadow-paper",
        className,
      )}
      {...props}
    />
  );
}
