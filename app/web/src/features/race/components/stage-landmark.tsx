import type { CSSProperties } from "react";
import { STAGES, type StageKey } from "../stages";
import { RaceScene } from "./race-scene";

/** Static samples use the exact same landmarks as the animated rail. */
export function StageLandmark({ stage, size = 30, className, style }: {
  stage: StageKey;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const threshold = STAGES.find((entry) => entry.key === stage)!.threshold;
  return <span className={className} style={style}>
    <RaceScene count={threshold} occupied={false} size={size} />
  </span>;
}
