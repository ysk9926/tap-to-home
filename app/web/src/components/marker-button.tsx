import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type MarkerButtonProps = ComponentPropsWithoutRef<"button"> & {
  /** primary: 종이 바탕 · ghost: 투명 바탕 */
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
};

/** 알약 모양 일반 버튼. 도감 보기, 공유, 다시 하기 등 */
export function MarkerButton({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: MarkerButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "mk mk-pill font-ui font-bold text-ink text-center cursor-pointer select-none whitespace-nowrap",
        "transition-transform duration-75 ease-[steps(2)] active:scale-95 active:-rotate-1",
        "focus-visible:outline-3 focus-visible:outline-dashed focus-visible:outline-pencil focus-visible:outline-offset-4",
        "disabled:cursor-default disabled:text-pencil-soft disabled:active:scale-100 disabled:active:rotate-0",
        variant === "ghost" && "bg-transparent",
        size === "md" ? "px-4 py-2.5 text-xl" : "px-3.5 py-1.5 text-base",
        className,
      )}
      {...props}
    />
  );
}
