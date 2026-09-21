import "server-only";

import { prisma } from "@/lib/db";
import { kstMinutes, todayKst } from "@/lib/kst";
import { STAGES } from "@/features/race/stages";
import { TITLES } from "@/features/titles/catalog";
import type { Cohort, DashboardData, DateRange, Metric } from "../types";
import { parseRange } from "./range";

const DAY_MS = 24 * 60 * 60 * 1000;

type CountRow = { count: bigint | number };
type DailyCountRow = { date: Date; count: bigint | number };
type RunSummaryRow = {
  playerDays: bigint | number;
  completedDays: bigint | number;
  medianTaps: number | string | null;
};
type ActivationRow = {
  eligible30s: bigint | number;
  activated30s: bigint | number;
  eligible24h: bigint | number;
  activated24h: bigint | number;
};
type ReceiptRow = { eligible: bigint | number; received: bigint | number };
type CohortRow = {
  date: Date;
  size: bigint | number;
  d1: bigint | number;
  d7: bigint | number;
};
type HourRow = { hour: number | string; taps: bigint | number; players: bigint | number };
type TitleRow = { id: string; count: bigint | number };
type SocialRow = { connected: boolean; size: bigint | number; retained: bigint | number };

type PeriodStats = {
  signups: number;
  playerDays: number;
  completedDays: number;
  medianTaps: number | null;
  visitorDays: number;
  visitorPlayerDays: number;
  eligible30s: number;
  activated30s: number;
  eligible24h: number;
  activated24h: number;
  signalEligible: number;
  signalsReceived: number;
  resultEligible: number;
  resultsViewed: number;
};

function number(value: bigint | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round((numerator / denominator) * 100);
}

function dateValue(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDays(ymd: string, days: number): string {
  return new Date(dateValue(ymd).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function kstBoundary(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+09:00`);
}

function rangeBounds(range: DateRange): { fromDate: Date; toDate: Date; fromTime: Date; toTime: Date } {
  return {
    fromDate: dateValue(range.from),
    toDate: dateValue(range.to),
    fromTime: kstBoundary(range.from),
    toTime: kstBoundary(addDays(range.to, 1)),
  };
}

function previousRange(range: DateRange): DateRange {
  const to = addDays(range.from, -1);
  return { from: addDays(to, 1 - range.days), to, days: range.days };
}

function datesIn(range: DateRange): string[] {
  return Array.from({ length: range.days }, (_, index) => addDays(range.from, index));
}

function countMap(rows: DailyCountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), number(row.count)]));
}

function valueMetric(
  id: string,
  label: string,
  value: number,
  unit: string,
  hint: string,
  previous?: number | null,
): Metric {
  return { id, label, value, unit, status: "ready", hint, ...(previous !== undefined ? { previous } : {}) };
}

function ratioMetric(
  id: string,
  label: string,
  numerator: number,
  denominator: number,
  hint: string,
  previous?: number | null,
): Metric {
  return {
    id,
    label,
    value: ratio(numerator, denominator),
    unit: "%",
    numerator,
    denominator,
    status: denominator === 0 ? "empty" : "ready",
    hint,
    ...(previous !== undefined ? { previous } : {}),
  };
}

function collectingMetric(id: string, label: string, unit: string, hint: string): Metric {
  return { id, label, value: null, unit, status: "collecting", hint };
}

async function loadPeriodStats(range: DateRange, now: Date): Promise<PeriodStats> {
  const { fromDate, toDate, fromTime, toTime } = rangeBounds(range);
  const observedToTime = toTime > now ? now : toTime;
  const [signups, runs, visits, activation, signals, results] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "user" u
      WHERE u."analyticsExcluded" = false
        AND u."createdAt" >= ${fromTime}
        AND u."createdAt" < ${observedToTime}
    `,
    prisma.$queryRaw<RunSummaryRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE r."tapCount" > 0) AS "playerDays",
        COUNT(*) FILTER (WHERE r."tapCount" >= 5000) AS "completedDays",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY r."tapCount")
          FILTER (WHERE r."tapCount" > 0) AS "medianTaps"
      FROM "daily_run" r
      JOIN "user" u ON u.id = r."userId"
      WHERE u."analyticsExcluded" = false
        AND r."runDate" >= ${fromDate}
        AND r."runDate" <= ${toDate}
        AND r."firstTapAt" <= ${now}
    `,
    prisma.$queryRaw<Array<{ visitorDays: bigint | number; playerDays: bigint | number }>>`
      SELECT
        COUNT(*) AS "visitorDays",
        COUNT(*) FILTER (WHERE COALESCE(r."tapCount", 0) > 0) AS "playerDays"
      FROM "user_daily_activity" a
      JOIN "user" u ON u.id = a."userId"
      LEFT JOIN "daily_run" r
        ON r."userId" = a."userId" AND r."runDate" = a."activityDate" AND r."firstTapAt" <= ${now}
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" >= ${fromDate}
        AND a."activityDate" <= ${toDate}
        AND a."firstSeenAt" <= ${now}
    `,
    prisma.$queryRaw<ActivationRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE u."createdAt" <= (${now}::timestamp - interval '30 seconds')) AS "eligible30s",
        COUNT(*) FILTER (
          WHERE u."createdAt" <= (${now}::timestamp - interval '30 seconds')
            AND first_tap.at <= u."createdAt" + interval '30 seconds'
        ) AS "activated30s",
        COUNT(*) FILTER (WHERE u."createdAt" <= (${now}::timestamp - interval '24 hours')) AS "eligible24h",
        COUNT(*) FILTER (
          WHERE u."createdAt" <= (${now}::timestamp - interval '24 hours')
            AND first_tap.at <= u."createdAt" + interval '24 hours'
        ) AS "activated24h"
      FROM "user" u
      LEFT JOIN LATERAL (
        SELECT MIN(r."firstTapAt") AS at
        FROM "daily_run" r
        WHERE r."userId" = u.id
          AND r."firstTapAt" >= u."createdAt" AND r."firstTapAt" <= ${now}
      ) first_tap ON true
      WHERE u."analyticsExcluded" = false
        AND u."createdAt" >= ${fromTime}
        AND u."createdAt" < ${observedToTime}
    `,
    prisma.$queryRaw<ReceiptRow[]>`
      SELECT
        COUNT(*) AS eligible,
        COUNT(*) FILTER (WHERE s."readAt" <= s."sentAt" + interval '24 hours') AS received
      FROM "signal" s
      JOIN "user" sender ON sender.id = s."senderId"
      JOIN "user" receiver ON receiver.id = s."receiverId"
      WHERE sender."analyticsExcluded" = false
        AND receiver."analyticsExcluded" = false
        AND s."sentAt" >= ${fromTime}
        AND s."sentAt" < ${observedToTime}
        AND s."sentAt" <= (${now}::timestamp - interval '24 hours')
    `,
    prisma.$queryRaw<ReceiptRow[]>`
      SELECT
        COUNT(*) AS eligible,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1
          FROM "product_event" e
          WHERE e.type = 'result_viewed'
            AND e."userId" = r."userId"
            AND e."entityId" = r.id
            AND e."occurredAt" >= result."settledAt"
            AND e."occurredAt" <= result."settledAt" + interval '24 hours'
        )) AS received
      FROM "daily_result" result
      JOIN "daily_run" r ON r.id = result."dailyRunId"
      JOIN "user" u ON u.id = r."userId"
      WHERE u."analyticsExcluded" = false
        AND result."settledAt" >= ${fromTime}
        AND result."settledAt" < ${observedToTime}
        AND result."settledAt" <= (${now}::timestamp - interval '24 hours')
    `,
  ]);

  const run = runs[0];
  const visit = visits[0];
  const activated = activation[0];
  const signal = signals[0];
  const result = results[0];
  return {
    signups: number(signups[0]?.count),
    playerDays: number(run?.playerDays),
    completedDays: number(run?.completedDays),
    medianTaps: run?.medianTaps == null ? null : number(run.medianTaps),
    visitorDays: number(visit?.visitorDays),
    visitorPlayerDays: number(visit?.playerDays),
    eligible30s: number(activated?.eligible30s),
    activated30s: number(activated?.activated30s),
    eligible24h: number(activated?.eligible24h),
    activated24h: number(activated?.activated24h),
    signalEligible: number(signal?.eligible),
    signalsReceived: number(signal?.received),
    resultEligible: number(result?.eligible),
    resultsViewed: number(result?.received),
  };
}

function cohortMetric(
  id: string,
  label: string,
  numerator: number,
  denominator: number,
  ready: boolean,
): Metric {
  if (!ready) return collectingMetric(id, label, "%", "관찰일이 끝난 가입 코호트만 계산합니다.");
  return ratioMetric(id, label, numerator, denominator, "가입일로부터 정확한 날짜의 방문입니다.");
}

export async function getDashboard(params: URLSearchParams, now: Date = new Date()): Promise<DashboardData> {
  const range = parseRange(params, now);
  const priorRange = previousRange(range);
  const today = todayKst(now);
  const { fromDate, toDate, fromTime, toTime } = rangeBounds(range);
  const observedToTime = toTime > now ? now : toTime;
  const priorBounds = rangeBounds(priorRange);

  const config = await prisma.analyticsConfig.findUnique({ where: { id: "product" } });
  const collectionStartedAt = config?.startedAt ?? null;
  const firstFullCollectionDate = collectionStartedAt ? addDays(todayKst(collectionStartedAt), 1) : null;
  const completeVisitRange = firstFullCollectionDate !== null
    && range.from >= firstFullCollectionDate
    && range.to < today;
  const completePriorVisitRange = firstFullCollectionDate !== null
    && priorRange.from >= firstFullCollectionDate
    && priorRange.to < today;

  const [
    current,
    previous,
    activeMembers,
    dailyVisitors,
    dailyPlayers,
    dailySignups,
    dailyActivated,
    cohortRows,
    priorCohortRows,
    wauRows,
    mauRows,
    priorWauRows,
    priorMauRows,
    priorFinalDauRows,
    hourlyRows,
    titleRows,
    socialRows,
    unsettledRows,
  ] = await Promise.all([
    loadPeriodStats(range, now),
    loadPeriodStats(priorRange, now),
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "user"
      WHERE "analyticsExcluded" = false AND "deletedAt" IS NULL AND "suspendedAt" IS NULL
        AND "createdAt" <= ${now}
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT a."activityDate" AS date, COUNT(*) AS count
      FROM "user_daily_activity" a
      JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" >= ${fromDate} AND a."activityDate" <= ${toDate}
        AND a."firstSeenAt" <= ${now}
      GROUP BY a."activityDate"
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT r."runDate" AS date, COUNT(*) AS count
      FROM "daily_run" r
      JOIN "user" u ON u.id = r."userId"
      WHERE u."analyticsExcluded" = false AND r."tapCount" > 0
        AND r."runDate" >= ${fromDate} AND r."runDate" <= ${toDate}
        AND r."firstTapAt" <= ${now}
      GROUP BY r."runDate"
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS date,
             COUNT(*) AS count
      FROM "user" u
      WHERE u."analyticsExcluded" = false
        AND u."createdAt" >= ${fromTime} AND u."createdAt" < ${observedToTime}
      GROUP BY date
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS date,
             COUNT(*) FILTER (WHERE first_tap.at <= u."createdAt" + interval '24 hours') AS count
      FROM "user" u
      LEFT JOIN LATERAL (
        SELECT MIN(r."firstTapAt") AS at FROM "daily_run" r
        WHERE r."userId" = u.id
          AND r."firstTapAt" >= u."createdAt" AND r."firstTapAt" <= ${now}
      ) first_tap ON true
      WHERE u."analyticsExcluded" = false
        AND u."createdAt" >= ${fromTime} AND u."createdAt" < ${observedToTime}
      GROUP BY date
    `,
    prisma.$queryRaw<CohortRow[]>`
      SELECT signup.date,
             COUNT(*) AS size,
             COUNT(*) FILTER (WHERE d1."userId" IS NOT NULL) AS d1,
             COUNT(*) FILTER (WHERE d7."userId" IS NOT NULL) AS d7
      FROM (
        SELECT u.id, ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS date
        FROM "user" u
        WHERE u."analyticsExcluded" = false
          AND u."createdAt" >= ${fromTime} AND u."createdAt" < ${observedToTime}
      ) signup
      LEFT JOIN "user_daily_activity" d1
        ON d1."userId" = signup.id AND d1."activityDate" = signup.date + 1
      LEFT JOIN "user_daily_activity" d7
        ON d7."userId" = signup.id AND d7."activityDate" = signup.date + 7
      GROUP BY signup.date
      ORDER BY signup.date
    `,
    prisma.$queryRaw<CohortRow[]>`
      SELECT signup.date,
             COUNT(*) AS size,
             COUNT(*) FILTER (WHERE d1."userId" IS NOT NULL) AS d1,
             COUNT(*) FILTER (WHERE d7."userId" IS NOT NULL) AS d7
      FROM (
        SELECT u.id, ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS date
        FROM "user" u
        WHERE u."analyticsExcluded" = false
          AND u."createdAt" >= ${priorBounds.fromTime} AND u."createdAt" < ${priorBounds.toTime}
      ) signup
      LEFT JOIN "user_daily_activity" d1
        ON d1."userId" = signup.id AND d1."activityDate" = signup.date + 1
      LEFT JOIN "user_daily_activity" d7
        ON d7."userId" = signup.id AND d7."activityDate" = signup.date + 7
      GROUP BY signup.date
      ORDER BY signup.date
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT a."userId") AS count
      FROM "user_daily_activity" a JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" BETWEEN ${dateValue(addDays(range.to, -6))} AND ${toDate}
        AND a."firstSeenAt" <= ${now}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT a."userId") AS count
      FROM "user_daily_activity" a JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" BETWEEN ${dateValue(addDays(range.to, -29))} AND ${toDate}
        AND a."firstSeenAt" <= ${now}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT a."userId") AS count
      FROM "user_daily_activity" a JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" BETWEEN ${dateValue(addDays(priorRange.to, -6))} AND ${priorBounds.toDate}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT a."userId") AS count
      FROM "user_daily_activity" a JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false
        AND a."activityDate" BETWEEN ${dateValue(addDays(priorRange.to, -29))} AND ${priorBounds.toDate}
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "user_daily_activity" a JOIN "user" u ON u.id = a."userId"
      WHERE u."analyticsExcluded" = false AND a."activityDate" = ${priorBounds.toDate}
    `,
    prisma.$queryRaw<HourRow[]>`
      SELECT EXTRACT(HOUR FROM (e."tappedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::int AS hour,
             SUM(e."batchSize") AS taps,
             COUNT(DISTINCT r."userId") AS players
      FROM "tap_event" e
      JOIN "daily_run" r ON r.id = e."dailyRunId"
      JOIN "user" u ON u.id = r."userId"
      WHERE u."analyticsExcluded" = false
        AND e."tappedAt" >= ${fromTime} AND e."tappedAt" < ${observedToTime}
      GROUP BY hour
    `,
    prisma.$queryRaw<TitleRow[]>`
      SELECT title.id, COUNT(*) AS count
      FROM "daily_result" result
      JOIN "daily_run" r ON r.id = result."dailyRunId"
      JOIN "user" u ON u.id = r."userId"
      CROSS JOIN LATERAL unnest(result."titleIds") AS title(id)
      WHERE u."analyticsExcluded" = false
        AND r."runDate" >= ${fromDate} AND r."runDate" <= ${toDate}
        AND result."settledAt" <= ${now}
      GROUP BY title.id
    `,
    collectionStartedAt
      ? prisma.$queryRaw<SocialRow[]>`
          SELECT connected, COUNT(*) AS size,
                 COUNT(*) FILTER (WHERE d7."userId" IS NOT NULL) AS retained
          FROM (
            SELECT u.id,
                   ((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS signup_date,
                   EXISTS (
                     SELECT 1
                     FROM "product_event" e
                     WHERE e.type = 'friend_accepted'
                       AND e."occurredAt" >= u."createdAt"
                       AND e."occurredAt" <= u."createdAt" + interval '24 hours'
                       AND (
                         (e."userId" = u.id AND EXISTS (
                           SELECT 1 FROM "user" other_user
                           WHERE other_user.id = e."otherUserId" AND other_user."analyticsExcluded" = false
                         ))
                         OR
                         (e."otherUserId" = u.id AND EXISTS (
                           SELECT 1 FROM "user" actor
                           WHERE actor.id = e."userId" AND actor."analyticsExcluded" = false
                         ))
                       )
                   ) AS connected
            FROM "user" u
            WHERE u."analyticsExcluded" = false
              AND u."createdAt" >= ${fromTime} AND u."createdAt" < ${observedToTime}
              AND u."createdAt" >= ${collectionStartedAt}
              AND (((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date + 8) <= ${dateValue(today)}
          ) cohort
          LEFT JOIN "user_daily_activity" d7
            ON d7."userId" = cohort.id AND d7."activityDate" = cohort.signup_date + 7
          GROUP BY connected
        `
      : Promise.resolve([] as SocialRow[]),
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "daily_run" r
      JOIN "user" u ON u.id = r."userId"
      LEFT JOIN "daily_result" result ON result."dailyRunId" = r.id
      WHERE u."analyticsExcluded" = false
        AND u."deletedAt" IS NULL AND u."suspendedAt" IS NULL
        AND r."tapCount" > 0 AND result."dailyRunId" IS NULL
        AND r."firstTapAt" <= ${now}
        AND r."runDate" >= ${fromDate} AND r."runDate" <= ${toDate}
        AND r."runDate" < ${dateValue(kstMinutes(now) >= 30 ? today : addDays(today, -1))}
    `,
  ]);

  const visitors = countMap(dailyVisitors);
  const players = countMap(dailyPlayers);
  const signups = countMap(dailySignups);
  const activated = countMap(dailyActivated);
  const allDates = datesIn(range);
  const trend = allDates.map((date) => ({
    date,
    visitors: firstFullCollectionDate !== null && date >= firstFullCollectionDate
      ? (visitors.get(date) ?? 0)
      : null,
    players: players.get(date) ?? 0,
    signups: signups.get(date) ?? 0,
    activated: addDays(date, 2) <= today ? (activated.get(date) ?? 0) : null,
  }));

  const cohortByDate = new Map(cohortRows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const cohorts: Cohort[] = allDates.map((date) => {
    const row = cohortByDate.get(date);
    const size = number(row?.size);
    const collectionReady = firstFullCollectionDate !== null && date >= firstFullCollectionDate;
    return {
      date,
      size,
      d1: cohortMetric("d1", "D1 재방문", number(row?.d1), size, collectionReady && addDays(date, 2) <= today),
      d7: cohortMetric("d7", "D7 재방문", number(row?.d7), size, collectionReady && addDays(date, 8) <= today),
    };
  });

  const matureD1 = cohorts.filter((cohort) => cohort.d1.status !== "collecting");
  const matureD7 = cohorts.filter((cohort) => cohort.d7.status !== "collecting");
  const d1Numerator = matureD1.reduce((sum, cohort) => sum + (cohort.d1.numerator ?? 0), 0);
  const d1Denominator = matureD1.reduce((sum, cohort) => sum + (cohort.d1.denominator ?? 0), 0);
  const d7Numerator = matureD7.reduce((sum, cohort) => sum + (cohort.d7.numerator ?? 0), 0);
  const d7Denominator = matureD7.reduce((sum, cohort) => sum + (cohort.d7.denominator ?? 0), 0);
  const priorD1Rows = priorCohortRows.filter((row) => {
    const date = row.date.toISOString().slice(0, 10);
    return firstFullCollectionDate !== null && date >= firstFullCollectionDate && addDays(date, 2) <= today;
  });
  const priorD7Rows = priorCohortRows.filter((row) => {
    const date = row.date.toISOString().slice(0, 10);
    return firstFullCollectionDate !== null && date >= firstFullCollectionDate && addDays(date, 8) <= today;
  });
  const priorHasMatureD1 = datesIn(priorRange).some((date) =>
    firstFullCollectionDate !== null && date >= firstFullCollectionDate && addDays(date, 2) <= today,
  );
  const priorHasMatureD7 = datesIn(priorRange).some((date) =>
    firstFullCollectionDate !== null && date >= firstFullCollectionDate && addDays(date, 8) <= today,
  );
  const priorD1Numerator = priorD1Rows.reduce((sum, row) => sum + number(row.d1), 0);
  const priorD1Denominator = priorD1Rows.reduce((sum, row) => sum + number(row.size), 0);
  const priorD7Numerator = priorD7Rows.reduce((sum, row) => sum + number(row.d7), 0);
  const priorD7Denominator = priorD7Rows.reduce((sum, row) => sum + number(row.size), 0);

  const wauComplete = firstFullCollectionDate !== null
    && addDays(range.to, -6) >= firstFullCollectionDate
    && range.to < today;
  const mauComplete = firstFullCollectionDate !== null
    && addDays(range.to, -29) >= firstFullCollectionDate
    && range.to < today;
  const priorWauComplete = firstFullCollectionDate !== null
    && addDays(priorRange.to, -6) >= firstFullCollectionDate
    && priorRange.to < today;
  const priorMauComplete = firstFullCollectionDate !== null
    && addDays(priorRange.to, -29) >= firstFullCollectionDate
    && priorRange.to < today;
  const finalDau = visitors.get(range.to) ?? 0;
  const priorFinalDau = number(priorFinalDauRows[0]?.count);
  const wau = number(wauRows[0]?.count);
  const mau = number(mauRows[0]?.count);
  const priorWau = number(priorWauRows[0]?.count);
  const priorMau = number(priorMauRows[0]?.count);
  const comparison = <T extends number | null>(value: T): T | undefined =>
    range.to < today ? value : undefined;

  const metrics: Metric[] = [
    valueMetric("active_members", "현재 정상 회원", number(activeMembers[0]?.count), "명", "현재 탈퇴·정지되지 않은 분석 대상 회원입니다."),
    valueMetric("signups", "기간 신규 가입", current.signups, "명", "선택 기간에 가입한 분석 대상 회원입니다.", comparison(previous.signups)),
    completeVisitRange
      ? valueMetric("average_visitors", "일평균 방문", round(current.visitorDays / range.days), "명", "일별 고유 방문자의 평균입니다.", completePriorVisitRange ? round(previous.visitorDays / priorRange.days) : null)
      : collectingMetric("average_visitors", "일평균 방문", "명", "완료된 수집 기간만 비교합니다."),
    valueMetric("play_dau", "일평균 플레이", round(current.playerDays / range.days), "명", "탭이 있는 사용자·날짜 수의 일평균입니다.", comparison(round(previous.playerDays / priorRange.days))),
    wauComplete
      ? valueMetric("wau", "방문 WAU", wau, "명", "마지막 기준일을 포함한 7일 고유 방문자입니다.", priorWauComplete ? priorWau : null)
      : collectingMetric("wau", "방문 WAU", "명", "7일 전체가 수집된 뒤 표시합니다."),
    mauComplete
      ? valueMetric("mau", "방문 MAU", mau, "명", "마지막 기준일을 포함한 30일 고유 방문자입니다.", priorMauComplete ? priorMau : null)
      : collectingMetric("mau", "방문 MAU", "명", "30일 전체가 수집된 뒤 표시합니다."),
    mauComplete
      ? ratioMetric("stickiness", "접속률 DAU/MAU", finalDau, mau, "선택 기간 마지막 완료일의 DAU를 30일 고유 방문자로 나눈 값입니다.", priorMauComplete ? ratio(priorFinalDau, priorMau) : null)
      : collectingMetric("stickiness", "접속률 DAU/MAU", "%", "30일 전체가 수집된 뒤 표시합니다."),
    completeVisitRange
      ? ratioMetric("play_participation", "방문자 플레이 참여율", current.visitorPlayerDays, current.visitorDays, "방문 사용자·날짜 중 탭이 있었던 비율입니다.", completePriorVisitRange ? ratio(previous.visitorPlayerDays, previous.visitorDays) : null)
      : collectingMetric("play_participation", "방문자 플레이 참여율", "%", "완료된 수집 기간만 계산합니다."),
    ratioMetric("activation_30s", "30초 내 첫 탭", current.activated30s, current.eligible30s, "가입 후 30초 관찰이 끝난 회원 기준입니다.", comparison(ratio(previous.activated30s, previous.eligible30s))),
    ratioMetric("activation_24h", "24시간 내 첫 탭", current.activated24h, current.eligible24h, "가입 후 24시간 관찰이 끝난 회원 기준입니다.", comparison(ratio(previous.activated24h, previous.eligible24h))),
    matureD1.length > 0
      ? ratioMetric("d1_retention", "D1 재방문", d1Numerator, d1Denominator, "가입 다음 KST 날짜의 방문입니다.", priorHasMatureD1 ? comparison(ratio(priorD1Numerator, priorD1Denominator)) : undefined)
      : collectingMetric("d1_retention", "D1 재방문", "%", "관찰 가능한 가입 코호트를 수집 중입니다."),
    matureD7.length > 0
      ? ratioMetric("d7_retention", "D7 재방문", d7Numerator, d7Denominator, "가입 7일 뒤 KST 날짜의 방문입니다.", priorHasMatureD7 ? comparison(ratio(priorD7Numerator, priorD7Denominator)) : undefined)
      : collectingMetric("d7_retention", "D7 재방문", "%", "가입 7일 뒤 하루가 끝나야 계산됩니다. 최근 30일·90일도 확인해 주세요."),
    ratioMetric("completion_rate", "플레이일 완주율", current.completedDays, current.playerDays, "탭이 있는 사용자·날짜 중 5,000회 이상인 비율입니다.", comparison(ratio(previous.completedDays, previous.playerDays))),
    current.medianTaps === null
      ? { id: "median_taps", label: "플레이일 탭 중앙값", value: null, unit: "회", status: "empty", hint: "탭이 있는 사용자·날짜의 중앙값입니다.", ...(comparison(previous.medianTaps) !== undefined ? { previous: comparison(previous.medianTaps) } : {}) }
      : valueMetric("median_taps", "플레이일 탭 중앙값", current.medianTaps, "회", "탭이 있는 사용자·날짜의 중앙값입니다.", comparison(previous.medianTaps)),
    ratioMetric("signal_read_24h", "신호 24시간 내 수신 확인", current.signalsReceived, current.signalEligible, "발송 후 24시간 관찰이 끝난 인앱 신호 기준입니다.", comparison(ratio(previous.signalsReceived, previous.signalEligible))),
    completeVisitRange
      ? ratioMetric("result_viewed_24h", "결과 24시간 내 상세 열람", current.resultsViewed, current.resultEligible, "계측 도입 후 정산되고 24시간 관찰이 끝난 결과 기준입니다.", completePriorVisitRange ? ratio(previous.resultsViewed, previous.resultEligible) : null)
      : collectingMetric("result_viewed_24h", "결과 24시간 내 상세 열람", "%", "실제 열람 계측이 있는 완료된 수집 기간만 계산합니다."),
  ];

  const totalPlayerDays = current.playerDays;
  const stages = [
    { label: "첫 탭", threshold: 1 },
    ...STAGES.filter((stage) => stage.threshold > 0).map(({ label, threshold }) => ({ label, threshold })),
  ].map(({ label, threshold }) => {
    const count = threshold === 1
      ? totalPlayerDays
      : 0;
    return { label, threshold, count, total: totalPlayerDays, rate: ratio(count, totalPlayerDays) };
  });
  const stageCounts = await prisma.$queryRaw<Array<{ threshold: number; count: bigint | number }>>`
    SELECT threshold, COUNT(*) AS count
    FROM "daily_run" r
    JOIN "user" u ON u.id = r."userId"
    CROSS JOIN (VALUES (750), (1600), (2500), (3650), (5000)) levels(threshold)
    WHERE u."analyticsExcluded" = false
      AND r."runDate" >= ${fromDate} AND r."runDate" <= ${toDate}
      AND r."tapCount" >= levels.threshold
      AND r."firstTapAt" <= ${now}
    GROUP BY threshold
  `;
  const stageCountMap = new Map(stageCounts.map((row) => [number(row.threshold), number(row.count)]));
  for (const stage of stages) {
    if (stage.threshold > 1) {
      stage.count = stageCountMap.get(stage.threshold) ?? 0;
      stage.rate = ratio(stage.count, totalPlayerDays);
    }
  }

  const hourMap = new Map(hourlyRows.map((row) => [number(row.hour), row]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    taps: number(hourMap.get(hour)?.taps),
    players: number(hourMap.get(hour)?.players),
  }));
  const titleCountMap = new Map(titleRows.map((row) => [row.id, number(row.count)]));
  const titles = TITLES.map(({ id, name }) => ({ id, name, count: titleCountMap.get(id) ?? 0 }));
  const socialMap = new Map(socialRows.map((row) => [row.connected, row]));
  const social = [
    { connected: true, label: "24시간 내 친구 연결" },
    { connected: false, label: "친구 연결 없음" },
  ].map(({ connected, label }) => {
    const row = socialMap.get(connected);
    const size = number(row?.size);
    const retained = number(row?.retained);
    return { label, size, retained, rate: ratio(retained, size) };
  });

  return {
    generatedAt: now.toISOString(),
    timezone: "Asia/Seoul",
    range,
    collectionStartedAt: collectionStartedAt?.toISOString() ?? null,
    metrics,
    trend,
    stages,
    cohorts,
    hourly,
    titles,
    social,
    unsettledRuns: number(unsettledRows[0]?.count),
  };
}
