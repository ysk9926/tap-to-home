import { cn } from "@/lib/cn";

/**
 * 연필 졸라맨. 40x60 박스 안의 선 하나(1.7px)로만 그린다.
 * `frame` 을 0/1 로 번갈아 주면 2프레임 스톱모션이 된다.
 */
export type StickmanPose =
  | "sit"
  | "stand"
  | "walk"
  | "run"
  | "subway"
  | "home"
  | "lie";

type PoseDef = {
  frames: [string, string];
  head: [number, number];
  /** 누운 포즈처럼 가로로 긴 경우 */
  wide?: boolean;
};

export const STICKMAN_POSES: Record<StickmanPose, PoseDef> = {
  sit: {
    frames: [
      "M20 18 L17 34 M17 34 L29 34 M29 34 L29 48 M19 26 L31 29 M10 48 H36 M13 48 V56 M33 48 V56 M27 22 L38 22 L36 30 L26 30 Z",
      "M20 18 L17 34 M17 34 L29 34 M29 34 L29 48 M19 26 L32 27 M10 48 H36 M13 48 V56 M33 48 V56 M27 22 L38 22 L36 30 L26 30 Z",
    ],
    head: [20, 11],
  },
  stand: {
    frames: [
      "M20 18 V38 M20 38 L15 56 M20 38 L25 56 M20 25 L12 35 M20 25 L28 35",
      "M20 18 V38 M20 38 L15 56 M20 38 L25 56 M20 25 L11 33 M20 25 L28 36",
    ],
    head: [20, 11],
  },
  walk: {
    frames: [
      "M20 18 L21 38 M21 38 L12 55 M21 38 L30 53 M20 25 L11 31 M20 25 L30 21",
      "M20 18 L21 38 M21 38 L18 56 M21 38 L26 56 M20 25 L13 33 M20 25 L28 32",
    ],
    head: [20, 11],
  },
  run: {
    frames: [
      "M23 18 L18 36 M18 36 L5 47 M18 36 L32 44 L30 54 M21 25 L32 16 M21 25 L9 29 M1 20 H7 M0 27 H5",
      "M23 18 L18 36 M18 36 L11 52 M18 36 L30 42 M21 25 L30 34 M21 25 L10 18 M1 20 H7 M0 27 H5",
    ],
    head: [24, 11],
  },
  subway: {
    frames: [
      "M20 18 V38 M20 38 L16 56 M20 38 L25 56 M20 25 L28 10 M28 10 V0 M20 25 L14 35",
      "M20 18 V38 M20 38 L16 56 M20 38 L25 56 M20 25 L29 9 M29 9 V0 M20 25 L13 34",
    ],
    head: [20, 11],
  },
  home: {
    frames: [
      "M20 18 V38 M20 38 L13 56 M20 38 L27 56 M20 25 L9 11 M20 25 L31 11 M6 4 L8 8 M34 4 L32 8",
      "M20 18 V38 M20 38 L13 56 M20 38 L27 56 M20 25 L10 9 M20 25 L30 9 M6 4 L8 8 M34 4 L32 8",
    ],
    head: [20, 11],
  },
  lie: {
    frames: [
      "M14 48 L36 48 M36 48 L52 50 M36 48 L50 44 M18 44 L26 40 M18 50 L12 54 M6 40 C4 36 10 34 12 38 M4 36 L2 32",
      "M14 48 L36 48 M36 48 L52 50 M36 48 L50 44 M18 44 L26 41 M18 50 L12 54 M6 40 C4 36 10 34 12 38 M4 36 L2 32",
    ],
    head: [12, 47],
    wide: true,
  },
};

export type StickmanProps = {
  pose: StickmanPose;
  /** 세로 높이(px). 기본 44 */
  size?: number;
  /** 0 | 1. 걷기 프레임 */
  frame?: 0 | 1;
  /** 결과 카드처럼 크게 쓸 때 선을 조금 굵게 */
  thick?: boolean;
  className?: string;
};

export function Stickman({
  pose,
  size = 44,
  frame = 0,
  thick = false,
  className,
}: StickmanProps) {
  const def = STICKMAN_POSES[pose];
  const [hx, hy] = def.head;
  const width = def.wide ? size * (56 / 60) * 1.4 : size * (40 / 60);
  const height = def.wide ? size * 0.55 : size;
  const viewBox = def.wide ? "0 28 56 30" : "0 0 40 60";

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      className={cn("block overflow-visible text-pencil", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={thick ? 2.2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={hx} cy={hy} r="7" />
      <path d={`M${hx - 3} ${hy - 1} v2 M${hx + 3} ${hy - 1} v2`} />
      <path d={def.frames[frame]} />
    </svg>
  );
}
