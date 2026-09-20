import { STAGES, progressOf } from "../stages";

/** 자리와 사람은 같은 60 단위 높이로 그려 좌판과 엉덩이가 맞는다. */
export const RACER_SIZE = 40;
const SEATED_CENTER = RACER_SIZE * (20 / 60);
const WORKSPACE_WIDTH = RACER_SIZE * (64 / 60) + 6;

/** 가구 공간을 확보하고, 첫 구간은 의자에서 엘리베이터까지 이어 준다. */
export function trackPositionOf(count: number): string {
  const progress = progressOf(count);
  const departure = Math.min(Math.max(count, 0) / STAGES[1].threshold, 1);
  const inset = SEATED_CENTER * (1 - departure)
    + WORKSPACE_WIDTH * departure * (1 - progress / 100);
  return `calc(${progress}% + ${inset}px)`;
}
