import type { StickmanPose } from "@/components/stickman";

export type StageKey = "seat" | "elevator" | "lobby" | "crosswalk" | "subway" | "home";

/** F1-1 단계와 임계값. docs/features.md 의 표가 기준 */
export type Stage = {
  key: StageKey;
  label: string;
  /** 진행 바에서 쓰는 짧은 이름 */
  short: string;
  threshold: number;
  pose: StickmanPose;
};

/**
 * 집까지 10000번. 간격이 뒤로 갈수록 벌어져(1500→1700→1800→2300→2700) 막판이 제일 길다.
 * 단계 수(0~5)는 daily_run.stage 에 저장되므로 항목을 늘리거나 줄이면 docs/data-model.md 도 고친다.
 */
export const STAGES: readonly Stage[] = [
  { key: "seat", label: "자리", short: "자리", threshold: 0, pose: "sit" },
  { key: "elevator", label: "엘리베이터", short: "엘베", threshold: 1500, pose: "stand" },
  { key: "lobby", label: "로비", short: "로비", threshold: 3200, pose: "walk" },
  { key: "crosswalk", label: "횡단보도", short: "횡단보도", threshold: 5000, pose: "run" },
  { key: "subway", label: "지하철", short: "지하철", threshold: 7300, pose: "subway" },
  { key: "home", label: "집", short: "집", threshold: 10000, pose: "home" },
];

export const HOME_THRESHOLD = STAGES[STAGES.length - 1].threshold;

/** 누적 횟수로 현재 단계를 구한다 */
export function stageOf(count: number): Stage {
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (count >= stage.threshold) current = stage;
  }
  return current;
}

/** 자리를 떠난 뒤에는 엘리베이터에 닿기 전이라도 걸어간다. */
export function poseOf(count: number): StickmanPose {
  const stage = stageOf(count);
  return stage.key === "seat" && count > 0 ? "walk" : stage.pose;
}

/** 경로 위 위치(0~100%). 집에 도착한 뒤에는 100 에 고정. 단계 랜드마크 위치도 이 함수에 threshold 를 넣어 구한다 */
export function progressOf(count: number): number {
  return (Math.min(count, HOME_THRESHOLD) / HOME_THRESHOLD) * 100;
}

/** DB 에 저장하는 단계 번호(0~5) */
export function stageIndexOf(count: number): number {
  return STAGES.indexOf(stageOf(count));
}
