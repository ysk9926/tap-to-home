import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate, kstTimeLabel, todayKst } from "@/lib/kst";
import { getRaceToday } from "@/features/race/server/today";
import { isTitleId, type TitleId } from "../catalog";
import { peakHour } from "../evaluate";

export type TodaySummary = {
  date: string;
  total: number;
  /** "09:32" */
  firstTapAt: string | null;
  peakHour: number | null;
  rank: number;
  rankTotal: number;
  result: { primaryTitleId: TitleId | null; titleIds: TitleId[]; newTitleIds: TitleId[] } | null;
};

/** /today 화면 데이터. 정산 전에는 result 가 null */
export async function getTodaySummary(user: CurrentUser, now: Date = new Date()): Promise<TodaySummary> {
  const runDate = kstDate(now);
  const [run, race] = await Promise.all([
    prisma.dailyRun.findUnique({
      where: { userId_runDate: { userId: user.id, runDate } },
      include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
    }),
    getRaceToday(user, now),
  ]);

  let result: TodaySummary["result"] = null;
  if (run?.result) {
    const titleIds = run.result.titleIds.filter(isTitleId);
    const newRows = await prisma.userTitle.findMany({
      where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
      select: { titleId: true },
    });
    result = {
      primaryTitleId: run.result.primaryTitleId && isTitleId(run.result.primaryTitleId) ? run.result.primaryTitleId : null,
      titleIds,
      newTitleIds: newRows.map((r) => r.titleId).filter(isTitleId),
    };
  }

  return {
    date: todayKst(now),
    total: run?.tapCount ?? 0,
    firstTapAt: run?.firstTapAt ? kstTimeLabel(run.firstTapAt) : null,
    peakHour: peakHour(run?.tapEvents ?? []),
    rank: race.racers.findIndex((r) => r.isMe) + 1,
    rankTotal: race.racers.length,
    result,
  };
}
