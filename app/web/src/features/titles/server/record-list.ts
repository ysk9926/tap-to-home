import "server-only";
import { recordResultViewed } from "@/features/analytics/server/events";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";
import { kstDate, kstTimeLabel, runDateToYmd } from "@/lib/kst";
import { isTitleId, type TitleId } from "../catalog";
import { peakHour } from "../evaluate";
import type { TodaySummary } from "./today-summary";

export type RecordSummary = {
  /** "YYYY-MM-DD" */
  date: string;
  total: number;
  primaryTitleId: TitleId | null;
  titleCount: number;
  /** 그날 처음 얻은 칭호가 있었는지 (목록의 NEW 배지) */
  hasNew: boolean;
  rank: number;
  rankTotal: number;
};

/** 페이지네이션 없이 최근 30일만 본다. 더 필요해지면 그때 커서를 붙인다 */
const WINDOW_DAYS = 30;

/** 정산이 끝난 날들. 최신순 */
export async function listRecords(userId: string, now: Date = new Date()): Promise<RecordSummary[]> {
  const since = new Date(kstDate(now).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const runs = await prisma.dailyRun.findMany({
    where: { userId, runDate: { gte: since }, result: { isNot: null } },
    select: { runDate: true, tapCount: true, result: true },
    orderBy: { runDate: "desc" },
  });

  const newRows = await prisma.userTitle.findMany({
    where: { userId, firstEarnedOn: { gte: since } },
    select: { firstEarnedOn: true },
  });
  const newDates = new Set(newRows.map((r) => runDateToYmd(r.firstEarnedOn)));

  return runs.map((run) => {
    const date = runDateToYmd(run.runDate);
    const primary = run.result?.primaryTitleId;
    return {
      date,
      total: run.tapCount,
      primaryTitleId: primary && isTitleId(primary) ? primary : null,
      titleCount: run.result?.titleIds.filter(isTitleId).length ?? 0,
      hasNew: newDates.has(date),
      rank: run.result?.rank ?? 0,
      rankTotal: run.result?.rankTotal ?? 0,
    };
  });
}

/**
 * 지난 날 하나의 상세. 화면 모양이 오늘 카드와 같아 `TodaySummary` 를 그대로 돌려준다.
 * 상세를 열면 결과를 본 것으로 간주해 `seenAt` 을 채운다 — 진입 다이얼로그가 다시 뜨지
 * 않게 한다 (푸시를 탭해 바로 들어온 경우가 이 경로다).
 */
export async function getRecordDetail(user: CurrentUser, ymd: string): Promise<TodaySummary | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const runDate = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(runDate.getTime())) return null;

  const active = await prisma.user.findFirst({ where: { id: user.id, ...ACTIVE_USER }, select: { id: true } });
  if (!active) return null;

  const run = await prisma.dailyRun.findUnique({
    where: { userId_runDate: { userId: user.id, runDate } },
    include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
  });
  if (!run?.result) return null;

  const titleIds = run.result.titleIds.filter(isTitleId);
  const newRows = await prisma.userTitle.findMany({
    where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
    select: { titleId: true },
  });

  await prisma.$transaction(async (tx) => {
    if (!run.result?.seenAt) {
      await tx.dailyResult.update({ where: { dailyRunId: run.id }, data: { seenAt: new Date() } });
    }
    await recordResultViewed(tx, user.id, run.id);
  });

  return {
    date: ymd,
    total: run.tapCount,
    firstTapAt: run.firstTapAt ? kstTimeLabel(run.firstTapAt) : null,
    peakHour: peakHour(run.tapEvents),
    rank: run.result.rank,
    rankTotal: run.result.rankTotal,
    result: {
      primaryTitleId:
        run.result.primaryTitleId && isTitleId(run.result.primaryTitleId)
          ? run.result.primaryTitleId
          : null,
      titleIds,
      newTitleIds: newRows.map((r) => r.titleId).filter(isTitleId),
    },
  };
}
