"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./admin.module.css";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function kstDate(daysAgo: number) {
  return dateFormatter.format(new Date(Date.now() - daysAgo * 86_400_000));
}

function presetRange(days: number) {
  return { from: kstDate(days), to: kstDate(1) };
}

export function DateRangeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaults = useMemo(() => presetRange(7), []);
  const [from, setFrom] = useState(searchParams.get("from") ?? defaults.from);
  const [to, setTo] = useState(searchParams.get("to") ?? defaults.to);
  const [error, setError] = useState<string | null>(null);

  function update(nextFrom: string, nextTo: string) {
    const start = new Date(`${nextFrom}T00:00:00+09:00`);
    const end = new Date(`${nextTo}T00:00:00+09:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (!nextFrom || !nextTo || days < 1 || days > 90) {
      setError("시작일과 종료일을 순서대로, 최대 90일까지 골라 주세요.");
      return;
    }
    setError(null);
    setFrom(nextFrom);
    setTo(nextTo);
    const next = new URLSearchParams(searchParams.toString());
    next.set("from", nextFrom);
    next.set("to", nextTo);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const selectedDays = Math.floor((new Date(`${to}T00:00:00+09:00`).getTime() - new Date(`${from}T00:00:00+09:00`).getTime()) / 86_400_000) + 1;

  return (
    <div>
      <div className={styles.toolbar} aria-label="조회 기간">
        <div className={styles.presets}>
          <button
            type="button"
            className={`${styles.preset} ${from === kstDate(0) && to === kstDate(0) ? styles.presetActive : ""}`}
            onClick={() => update(kstDate(0), kstDate(0))}
          >오늘 · 집계 중</button>
          {[7, 30, 90].map((days) => {
            const range = presetRange(days);
            const active = from === range.from && to === range.to;
            return (
              <button
                type="button"
                key={days}
                className={`${styles.preset} ${active ? styles.presetActive : ""}`}
                onClick={() => update(range.from, range.to)}
              >최근 {days}일</button>
            );
          })}
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-from">시작일</label>
          <input id="admin-from" className={styles.input} type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="admin-to">종료일</label>
          <input id="admin-to" className={styles.input} type="date" value={to} min={from} max={kstDate(0)} onChange={(event) => setTo(event.target.value)} />
        </div>
        <button type="button" className={styles.quietButton} onClick={() => update(from, to)}>적용</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!error && selectedDays > 0 && <span className={`${styles.panelNote} ${styles.data}`}>KST · {selectedDays}일</span>}
    </div>
  );
}
