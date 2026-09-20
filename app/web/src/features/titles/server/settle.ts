import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { getRaceToday } from "@/features/race/server/today";
import { isTitleId, type TitleId } from "../catalog";
import { evaluateTitles, pickPrimary } from "../evaluate";

export type SettleResult = {
  alreadySettled: boolean;
  titleIds: TitleId[];
  primaryTitleId: TitleId | null;
  /** 오늘 처음 얻은 것 (도감 NEW) */
  newTitleIds: TitleId[];
  rank: number;
  rankTotal: number;
};

function toTitleIds(ids: string[]): TitleId[] {
  return ids.filter(isTitleId);
}

/**
 * "오늘 정산" (F3). 한 번만 실행되고, 이미 정산됐으면 저장된 결과를 돌려준다.
 *
 * `recordTaps` 와 이 함수는 같은 `daily_run` 행을 두고 경쟁한다: 탭은 그 행을 UPDATE 하고,
 * 정산은 그 행에 딸린 `daily_result` 를 만든다. 두 작업이 "정산 여부"에 대해 항상 같은 답을
 * 보게 하려면 하나의 interactive transaction 안에서 그 행을 `SELECT ... FOR UPDATE` 로
 * 잠근 뒤에 읽어야 한다 (`recordTaps` 의 UPDATE 도 같은 행 lock 을 잡으므로 직렬화된다).
 * 그래서 아래는 브리프의 순차 버전 대신, 1) upsert 로 행을 보장하고 2) 그 행을 잠그고
 * 3) 잠근 뒤에 읽는 순서로 구현한다. 랭킹 조회(`getRaceToday`)도 `tx` 로 넘겨, 이 함수 안의
 * 모든 DB 접근이 같은 트랜잭션 커넥션을 쓰고 같은 스냅샷을 보게 한다. (커넥션 풀이 5개뿐이라
 * 별도 클라이언트로 읽으면 진행 중인 정산마다 커넥션을 2개씩 잡아먹는다.)
 */
export async function settleToday(user: CurrentUser, now: Date = new Date()): Promise<SettleResult> {
  return settleRun(user, kstDate(now), now);
}

/**
 * 특정 날짜(KST)의 정산. 자정 크론은 어제 날짜로, 화면은 오늘 날짜로 부른다.
 * `runDate` 는 `kstDate()` 가 만든 UTC 자정 Date 여야 한다 (`@db.Date` 컬럼 값).
 */
export async function settleRun(
  user: CurrentUser,
  runDate: Date,
  now: Date = new Date(),
): Promise<SettleResult> {
  return prisma.$transaction(async (tx) => {
    // 1. 오늘 run 을 보장하고
    const { id } = await tx.dailyRun.upsert({
      where: { userId_runDate: { userId: user.id, runDate } },
      create: { userId: user.id, runDate },
      update: {},
      select: { id: true },
    });

    // 2. 행 잠금: 동시에 들어오는 recordTaps(같은 행을 UPDATE) 와 직렬화된다
    await tx.$queryRaw`SELECT id FROM daily_run WHERE id = ${id} FOR UPDATE`;

    // 3. 잠근 뒤에 읽는다
    const run = await tx.dailyRun.findUniqueOrThrow({
      where: { id },
      include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
    });

    if (run.result) {
      const titleIds = toTitleIds(run.result.titleIds);
      const newRows = await tx.userTitle.findMany({
        where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
        select: { titleId: true },
      });
      return {
        alreadySettled: true,
        titleIds,
        primaryTitleId: run.result.primaryTitleId && isTitleId(run.result.primaryTitleId) ? run.result.primaryTitleId : null,
        newTitleIds: toTitleIds(newRows.map((r) => r.titleId)),
        rank: run.result.rank,
        rankTotal: run.result.rankTotal,
      };
    }

    const titleIds = evaluateTitles({ taps: run.tapEvents, total: run.tapCount, firstTapAt: run.firstTapAt });
    const primaryTitleId = pickPrimary(titleIds);

    // 랭킹은 정산 대상 날짜 기준이어야 한다. 크론은 자정을 넘긴 뒤 어제를 정산하므로
    // `now` 를 그대로 넘기면 아직 아무도 누르지 않은 오늘 랭킹이 저장된다.
    const race = await getRaceToday(user, runDate, tx);
    const rank = race.racers.findIndex((r) => r.isMe) + 1;
    const rankTotal = race.racers.length;

    const existing = await tx.userTitle.findMany({
      where: { userId: user.id, titleId: { in: titleIds } },
      select: { titleId: true },
    });
    const owned = new Set(existing.map((e) => e.titleId));
    const newTitleIds = titleIds.filter((id) => !owned.has(id));

    for (const titleId of titleIds) {
      await tx.userTitle.upsert({
        where: { userId_titleId: { userId: user.id, titleId } },
        create: { userId: user.id, titleId, firstEarnedOn: runDate, earnedCount: 1 },
        update: { earnedCount: { increment: 1 } },
      });
    }
    await tx.dailyResult.create({
      data: { dailyRunId: run.id, primaryTitleId, titleIds, rank, rankTotal },
    });

    return { alreadySettled: false, titleIds, primaryTitleId, newTitleIds, rank, rankTotal };
  });
}
