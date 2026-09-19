import type { StickmanPose } from "@/components/stickman";

/**
 * 칭호 마스터 (docs/decisions/0005). DB 에는 id 만 저장한다.
 * priority 가 작을수록 대표 칭호로 먼저 뽑힌다. 조건은 evaluate.ts.
 */
export type TitleId =
  | "heart_already_home"
  | "last_hour_sprinter"
  | "post_lunch_slump"
  | "early_leaver"
  | "bearable_day";

export type TitleDef = {
  id: TitleId;
  name: string;
  /** 도감 미획득 칸의 힌트 */
  hint: string;
  pose: StickmanPose;
  priority: number;
};

export const TITLES: readonly TitleDef[] = [
  { id: "heart_already_home", name: "마음만 이미 집에 있음", hint: "하루 100번", pose: "lie", priority: 1 },
  { id: "last_hour_sprinter", name: "퇴근 1시간 전 폭주형", hint: "17시 이후 30번", pose: "run", priority: 2 },
  { id: "post_lunch_slump", name: "점심 먹고 모든 의욕을 잃은 자", hint: "오후에 몰아서", pose: "sit", priority: 3 },
  { id: "early_leaver", name: "출근하자마자 집 가고 싶었던 자", hint: "9시 반 전에 첫 탭", pose: "home", priority: 4 },
  { id: "bearable_day", name: "오늘은 버틸 만했던 자", hint: "10번 미만인 날", pose: "stand", priority: 5 },
];

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<TitleId, TitleDef>;

export function isTitleId(s: string): s is TitleId {
  return s in TITLE_BY_ID;
}
