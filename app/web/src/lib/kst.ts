/** 하루 기준은 KST(UTC+9) 고정. docs/goal.md 의 "하루의 기준 시각" 결정 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function shifted(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}

/** 오늘의 KST 날짜 "YYYY-MM-DD" */
export function todayKst(now: Date = new Date()): string {
  return shifted(now).toISOString().slice(0, 10);
}

/** Prisma `@db.Date` 컬럼에 넣는 값. 해당 KST 날짜의 UTC 자정 */
export function kstDate(now: Date = new Date()): Date {
  return new Date(`${todayKst(now)}T00:00:00.000Z`);
}

/** `@db.Date` 로 읽은 값을 "YYYY-MM-DD" 로 */
export function runDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function kstHour(d: Date): number {
  return shifted(d).getUTCHours();
}

/** 자정부터 지난 분. 09:30 → 570 */
export function kstMinutes(d: Date): number {
  const s = shifted(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

/** "09:32" */
export function kstTimeLabel(d: Date): string {
  const s = shifted(d);
  const hh = String(s.getUTCHours()).padStart(2, "0");
  const mm = String(s.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "9월 19일 토요일" */
export function kstDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}
