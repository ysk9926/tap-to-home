import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/**
 * 손으로 그린 집. 레이스의 도착점.
 * 지붕·벽·바닥은 매직(2.2px), 굴뚝·연기·문·창문은 그 위에 얹은 가는 선(1.6px).
 * 직선 대신 살짝 휜 곡선을 쓰고 모서리는 조금씩 삐져나가게 둔다.
 */
export function HouseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      className="overflow-visible"
      aria-hidden="true"
      {...props}
    >
      {/* 지붕 → 벽 → 바닥 */}
      <path
        d="M2.8 18.4 Q9.4 12 15.2 6.4 Q21 12.2 27.6 18.1 M6.4 15 L6 29.2 M24.2 14.8 L24.6 29.2 M1.8 29.4 Q15 28.6 28.6 29.3"
        strokeWidth="2.2"
        {...stroke}
      />
      {/* 굴뚝 · 문 · 창문 */}
      <path
        d="M19.2 11.2 L19.3 7.4 L22.9 7.2 L23.1 14.2 M11.6 29.2 L11.5 21.2 Q13.6 20.5 15.8 21.2 L15.9 29.2 M14.3 25.2 l.1 0 M18.4 19.6 L22.4 19.5 L22.5 23.5 L18.5 23.6 Z"
        strokeWidth="1.6"
        {...stroke}
      />
      {/* 연기 */}
      <path
        d="M21 5.6 Q22.8 4.2 21.4 2.6 Q20.4 1.4 21.6 .6"
        strokeWidth="1.4"
        opacity=".7"
        {...stroke}
      />
    </svg>
  );
}

/** 퇴근 신호 알림 종 */
export function BellIcon({ size = 28, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" {...props}>
      <path
        d="M8 19 C8 10 9 7 14 6 C19 7 20 10 20 19 L23 22 H5 Z M12 24 C12 26 16 26 16 24 M14 3 V6"
        strokeWidth="2.4"
        {...stroke}
      />
      <path
        d="M23 6 L25 4 M24 11 H27 M4 6 L2 4 M4 11 H1"
        strokeWidth="2"
        {...stroke}
      />
    </svg>
  );
}

/** 1위 왕관 */
export function CrownIcon({ size = 14, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * (22 / 28)}
      viewBox="0 0 28 22"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 18 L3 7 L9 12 L14 4 L19 12 L25 7 L25 18 Z"
        strokeWidth="2.2"
        {...stroke}
      />
    </svg>
  );
}

/** 뒤로가기 화살표. 자로 그은 직선 대신 살짝 처진 손그림 */
export function BackArrowIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M20.4 12.3 Q12.2 11.6 4.2 12.1 M10.4 5.4 Q6.8 8.6 3.8 12.2 Q6.9 15.6 10.6 18.6"
        strokeWidth="2.2"
        {...stroke}
      />
    </svg>
  );
}
