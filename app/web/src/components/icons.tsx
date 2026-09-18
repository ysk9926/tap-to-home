import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** 매직으로 그린 집. 레이스의 도착점 */
export function HouseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size * (26 / 28)}
      viewBox="0 0 28 26"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M3 12 L14 3 L25 12 M6 11 V23 H22 V11 M12 23 V16 H17 V23"
        strokeWidth="2.2"
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
