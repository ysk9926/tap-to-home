import { kstHour, kstMinutes } from "@/lib/kst";
import { TITLE_BY_ID, type TitleId } from "./catalog";

export type TapSample = { tappedAt: Date; batchSize: number };

export type EvaluateInput = {
  taps: TapSample[];
  /** daily_run.tapCount */
  total: number;
  firstTapAt: Date | null;
};

function sumWhere(taps: TapSample[], pred: (t: TapSample) => boolean): number {
  return taps.reduce((acc, t) => acc + (pred(t) ? t.batchSize : 0), 0);
}

/** F3-1 규칙. 조건이 여러 개 맞으면 모두. 탭이 없는 날은 칭호 없음 */
export function evaluateTitles({ taps, total, firstTapAt }: EvaluateInput): TitleId[] {
  if (total <= 0) return [];
  const ids: TitleId[] = [];

  if (firstTapAt && kstMinutes(firstTapAt) < 9 * 60 + 30) ids.push("early_leaver");
  if (sumWhere(taps, (t) => kstHour(t.tappedAt) >= 13) / total >= 0.6) ids.push("post_lunch_slump");
  if (sumWhere(taps, (t) => kstHour(t.tappedAt) >= 17) >= 30) ids.push("last_hour_sprinter");
  if (total >= 100) ids.push("heart_already_home");
  if (total < 10) ids.push("bearable_day");

  return ids;
}

/** 대표 칭호: priority 가 가장 작은 것 */
export function pickPrimary(ids: TitleId[]): TitleId | null {
  if (ids.length === 0) return null;
  return [...ids].sort((a, b) => TITLE_BY_ID[a].priority - TITLE_BY_ID[b].priority)[0];
}

/** 가장 많이 누른 KST 시각(0~23). 정산 화면 표시용 */
export function peakHour(taps: TapSample[]): number | null {
  if (taps.length === 0) return null;
  const byHour = new Map<number, number>();
  for (const t of taps) {
    const h = kstHour(t.tappedAt);
    byHour.set(h, (byHour.get(h) ?? 0) + t.batchSize);
  }
  return [...byHour.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}
