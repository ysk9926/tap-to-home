import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type PaperProps = ComponentPropsWithoutRef<"div"> & {
  /** 왼쪽 빨간 여백선 위치(px). 0 이면 그리지 않는다 */
  marginLeft?: number;
};

/**
 * 줄노트 종이. 화면 하나의 바탕이 된다.
 * 내용은 여백선 오른쪽에 두도록 padding-left 를 함께 준다.
 */
export function Paper({
  marginLeft = 34,
  className,
  style,
  children,
  ...props
}: PaperProps) {
  return (
    <div
      className={cn("ruled relative", className)}
      style={{ paddingLeft: marginLeft ? marginLeft + 12 : undefined, ...style }}
      {...props}
    >
      {marginLeft > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 border-l-[1.5px] border-margin opacity-90"
          style={{ left: marginLeft }}
        />
      )}
      {children}
    </div>
  );
}

/** 화면 제목. 매직 글씨 */
export function ScreenTitle({ className, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn("font-ui text-[26px] font-bold leading-[1.1] text-balance", className)}
      {...props}
    />
  );
}

/** 제목 아래 한 줄 메모. 펜 글씨, 연한 색 */
export function Note({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("font-note text-xl text-pencil-soft", className)} {...props} />;
}
