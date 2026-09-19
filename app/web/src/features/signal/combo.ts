import type { SignalLevel } from "@/components/signal-toast";

/** F2: 마지막 탭에서 1.5초 이내 연속 탭을 하나의 연타로 묶는다 */
export const COMBO_WINDOW_MS = 1500;

/** 연타 수 → 신호 등급. features.md F2 표 */
const THRESHOLDS: ReadonlyArray<{ level: SignalLevel; taps: number }> = [
  { level: "rescue", taps: 30 },
  { level: "urgent", taps: 10 },
  { level: "strong", taps: 5 },
  { level: "normal", taps: 1 },
];

export function levelForTaps(taps: number): SignalLevel | null {
  return THRESHOLDS.find((t) => taps >= t.taps)?.level ?? null;
}

export type ComboTracker = {
  tap(at: number): void;
  /** 창이 닫혔으면(마지막 탭 + windowMs 경과) 최고 등급을 한 번 돌려주고 초기화 */
  settle(now: number): SignalLevel | null;
  count(): number;
};

export function createComboTracker(windowMs: number = COMBO_WINDOW_MS): ComboTracker {
  let count = 0;
  let lastAt = -Infinity;

  return {
    tap(at) {
      count = at - lastAt > windowMs ? 1 : count + 1;
      lastAt = at;
    },
    settle(now) {
      if (count === 0 || now - lastAt <= windowMs) return null;
      const level = levelForTaps(count);
      count = 0;
      lastAt = -Infinity;
      return level;
    },
    count: () => count,
  };
}
