import type { CSSProperties, ReactNode } from "react";
import { HouseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { StageKey } from "../stages";

type StageLandmarkProps = {
  stage: StageKey;
  /** 한 변(px). 정방형. 기본 30 */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * 경로 위 단계 랜드마크. 40×40 viewBox 에 그리고 바닥선(y≈39)이 트랙 선에 닿게 놓는다.
 * 직선 대신 살짝 휜 곡선, 조금씩 삐져나간 모서리, 군데군데 연한 보조선으로 연필 손그림 느낌을 낸다.
 * 선은 졸라맨과 같은 연필 1.7px 이라 졸라맨이 앞에 겹쳐도 지저분하지 않다.
 * 집은 도착점이라 매직 HouseIcon 을 그대로 쓴다.
 */
export function StageLandmark({ stage, size = 30, className, style }: StageLandmarkProps) {
  if (stage === "home") {
    return <HouseIcon size={size} className={cn("block", className)} style={style} />;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("block overflow-visible", className)}
      style={style}
      aria-hidden="true"
    >
      {LANDMARKS[stage]}
    </svg>
  );
}

const LANDMARKS: Record<Exclude<StageKey, "home">, ReactNode> = {
  /* 자리: 책상 위 모니터. 상판이 살짝 휘고 다리는 조금 기울었다 */
  seat: (
    <>
      <path d="M2.5 26 Q20 24.6 37.5 25.6 M6.5 26.4 L5.8 39 M33.5 25.8 L34.2 39" />
      <path d="M12.5 11.5 Q21.5 10.6 30 11.4 L30.4 21.8 Q21.5 22.5 12.9 21.9 Z M21.6 22.4 L21.4 25.4" />
      <path d="M16.5 15 Q19.5 14.6 24.5 15 M16.5 18.2 Q18.5 18 21.5 18.2" opacity=".55" />
    </>
  ),
  /* 엘리베이터: 문틀과 가운데 틈, 위에 ▲ 표시, 옆에 호출 버튼 */
  elevator: (
    <>
      <path d="M10.6 39 L10 9.5 Q20 8.4 30 9.3 L30.6 39 M20.2 10 L20.5 39" />
      <path d="M17.2 6.2 L20 3 L22.8 6.2" />
      <path d="M34.6 21.4 l.1 0" strokeWidth="3" />
      <path d="M12 13 L11.7 36" opacity=".4" />
    </>
  ),
  /* 로비: 기둥 두 개, 줄무늬 차양, 유리 이중문과 손잡이 */
  lobby: (
    <>
      <path d="M1.5 14.5 Q20 11.8 38.5 14.8 M2.5 18.4 Q20 16.2 37.5 18.6" />
      <path d="M12 13.9 L12.2 17.8 M20 13.4 L20 17.3 M28 13.9 L27.8 17.8" opacity=".55" />
      <path d="M6.5 18.8 L6 39 M33.5 18.9 L34 39" />
      <path d="M13.5 39 L13.2 22.5 Q20 21.7 26.8 22.5 L27 39 M20.1 22.6 L20.3 39" />
      <path d="M18.2 28.5 L18.3 32.5 M22 28.5 L21.9 32.5" />
    </>
  ),
  /* 횡단보도: 보행자 신호등과 비스듬한 줄무늬 세 개. 켜진 불은 채워서 */
  crosswalk: (
    <>
      <path d="M5 30.5 L5.3 16" />
      <path d="M2 4.5 Q5.2 3.6 8.4 4.5 L8.7 15.6 Q5.2 16.3 1.9 15.6 Z" />
      <circle cx="5.3" cy="7.8" r="1.6" />
      <circle cx="5.3" cy="12.4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10.5 39 L14.5 30.4 L19.5 30.2 L15.6 39 Z M20 39 L24.1 30.4 L29 30.3 L25 39 Z M29.6 39 L33.5 30.5 L38.5 30.3 L34.6 39 Z" />
    </>
  ),
  /* 지하철: 전동차 앞모습. 아치 차체, 앞창, 헤드라이트 둘, 연결기 */
  subway: (
    <>
      <path d="M7.5 39 L7 15 Q8 6.2 20 6 Q32 6.2 33 15 L33.5 39" />
      <path d="M11.5 12.5 Q20 11 28.5 12.4 L28.8 21.5 Q20 22.6 11.2 21.6 Z" />
      <circle cx="12.6" cy="29.4" r="2.2" />
      <circle cx="27.6" cy="29.6" r="2.2" />
      <path d="M16.5 34.6 Q20 34 23.5 34.6" />
      <path d="M9.4 18 L9.2 36" opacity=".4" />
    </>
  ),
};
