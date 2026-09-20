import "server-only";
import { prisma } from "@/lib/db";
import { runDateToYmd } from "@/lib/kst";
import { isTitleId, type TitleId } from "../catalog";

export type UnseenResult = {
  /** "YYYY-MM-DD" */
  date: string;
  primaryTitleId: TitleId | null;
  total: number;
  titleCount: number;
  rank: number;
  rankTotal: number;
};

/**
 * 아직 보지 않은 정산 결과 중 가장 최근 한 건.
 *
 * 며칠 자리를 비워 여러 건이 쌓였어도 한 건만 띄운다 — 다이얼로그를 세 번 닫게 하는 것보다
 * 어제 결과를 보여주고 기록 목록을 가리키는 편이 낫다. 나머지는 닫을 때 함께 seen 처리한다
 * (`markResultsSeenAction`).
 */
export async function getUnseenResult(userId: string): Promise<UnseenResult | null> {
  const run = await prisma.dailyRun.findFirst({
    where: { userId, result: { is: { seenAt: null } } },
    select: { runDate: true, tapCount: true, result: true },
    orderBy: { runDate: "desc" },
  });
  if (!run?.result) return null;

  const primary = run.result.primaryTitleId;
  return {
    date: runDateToYmd(run.runDate),
    primaryTitleId: primary && isTitleId(primary) ? primary : null,
    total: run.tapCount,
    titleCount: run.result.titleIds.filter(isTitleId).length,
    rank: run.result.rank,
    rankTotal: run.result.rankTotal,
  };
}
