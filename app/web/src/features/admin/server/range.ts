import { todayKst } from "@/lib/kst";
import type { DateRange } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new RangeError("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("올바른 날짜를 입력해 주세요.");
  }
  return date;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseRange(params: URLSearchParams, now: Date = new Date()): DateRange {
  const fromParam = params.get("from");
  const toParam = params.get("to");

  if ((fromParam === null) !== (toParam === null)) {
    throw new RangeError("from과 to를 함께 입력해 주세요.");
  }

  const today = parseDate(todayKst(now));
  if (fromParam === null || toParam === null) {
    const to = new Date(today.getTime() - DAY_MS);
    const from = new Date(to.getTime() - 6 * DAY_MS);
    return { from: ymd(from), to: ymd(to), days: 7 };
  }

  const from = parseDate(fromParam);
  const to = parseDate(toParam);
  if (from > to) throw new RangeError("시작일은 종료일보다 늦을 수 없습니다.");
  if (to > today) throw new RangeError("오늘 이후 날짜는 조회할 수 없습니다.");

  const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (days > 90) throw new RangeError("조회 기간은 최대 90일입니다.");

  return { from: fromParam, to: toParam, days };
}
