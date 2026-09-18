"use client";

import { useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

type TapButtonProps = {
  /** pointerdown 마다 호출. 연타가 핵심이므로 click 이 아니라 pointerdown 에 건다 */
  onTap: () => void;
  /** 정산 후 등 오늘 더 누를 수 없을 때 */
  disabled?: boolean;
  size?: number;
  children?: React.ReactNode;
  className?: string;
};

/**
 * "퇴근하고 싶다!" 메인 버튼. 매직으로 두 번 그린 원.
 * 누르면 살짝 찌그러지고 형광펜이 칠해진다.
 */
export function TapButton({
  onTap,
  disabled = false,
  size = 224,
  children = (
    <>
      퇴근하고
      <br />
      싶다!
    </>
  ),
  className,
}: TapButtonProps) {
  const [pressed, setPressed] = useState(false);

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    onTap();
    setPressed(true);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="퇴근하고 싶다, 누르면 횟수가 1 늘어납니다"
      onPointerDown={handlePointerDown}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onTap();
          setPressed(true);
        }
      }}
      onKeyUp={() => setPressed(false)}
      style={{ width: size, height: size }}
      className={cn(
        "relative grid place-items-center select-none touch-manipulation",
        "font-ui font-bold text-ink leading-[1.05] text-[clamp(20px,15cqw,34px)]",
        "transition-transform duration-75 ease-[steps(2)]",
        pressed && "scale-[.94] -rotate-[1.5deg]",
        disabled ? "cursor-default text-pencil-soft" : "cursor-pointer",
        "focus-visible:outline-3 focus-visible:outline-dashed focus-visible:outline-pencil focus-visible:outline-offset-6 focus-visible:rounded-full",
        className,
      )}
    >
      <svg
        viewBox="0 0 224 224"
        className="absolute inset-0 h-full w-full wobble"
        aria-hidden="true"
      >
        <path
          d="M112 14 C170 10 214 52 212 112 C210 172 166 212 110 212 C50 212 12 168 14 110 C16 50 56 18 112 14 Z"
          fill={pressed ? "var(--hilite)" : "var(--paper)"}
          stroke={disabled ? "var(--pencil-soft)" : "var(--marker)"}
          strokeWidth={disabled ? 2 : 4}
          strokeDasharray={disabled ? "5 4" : undefined}
          strokeLinecap="round"
        />
        {!disabled && (
          <path
            d="M112 22 C160 20 204 58 204 112 C204 164 162 204 112 204"
            fill="none"
            stroke="var(--marker)"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".55"
          />
        )}
      </svg>
      <span className="relative text-center text-balance">{children}</span>
    </button>
  );
}
