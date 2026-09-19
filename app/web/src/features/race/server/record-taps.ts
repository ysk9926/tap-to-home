import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { stageIndexOf } from "../stages";

export class RunSettledError extends Error {
  constructor() {
    super("오늘은 이미 정산했어요");
  }
}

/**
 * 배치 탭 저장 (docs/decisions/0002 "탭 저장 규칙").
 * 하나의 interactive transaction 으로 원자적으로 처리한다:
 *   1. daily_run 을 먼저 upsert 한다 — UPDATE 가 이 row 의 lock 을 트랜잭션이 끝날 때까지 쥔다.
 *   2. lock 을 쥔 뒤에 정산 여부를 확인한다. 정산(daily_result insert)도 같은 row 를 잠그므로
 *      (Task 9), 탭과 정산이 동시에 들어와도 둘 중 하나는 lock 을 기다렸다가 최신 상태를 보게 된다.
 *      정산돼 있으면 예외를 던져 증가분을 롤백한다.
 *   3. tap_event 기록과 stage 갱신을 같은 트랜잭션에서 커밋해, tapCount 와 stage 가 항상 같은
 *      커밋에서 함께 보이게 한다 (getRaceToday 같은 동시 reader 가 새 tapCount·옛 stage 를
 *      동시에 볼 수 없다).
 */
export async function recordTaps(
  userId: string,
  count: number,
  now: Date = new Date(),
): Promise<{ tapCount: number; stage: number }> {
  const runDate = kstDate(now);

  return prisma.$transaction(async (tx) => {
    const run = await tx.dailyRun.upsert({
      where: { userId_runDate: { userId, runDate } },
      create: {
        userId,
        runDate,
        tapCount: count,
        stage: stageIndexOf(count),
        firstTapAt: now,
        lastTapAt: now,
      },
      update: { tapCount: { increment: count }, lastTapAt: now },
      select: { id: true, tapCount: true, stage: true },
    });

    const settled = await tx.dailyResult.findUnique({
      where: { dailyRunId: run.id },
      select: { dailyRunId: true },
    });
    if (settled) throw new RunSettledError();

    const stage = stageIndexOf(run.tapCount);
    await tx.tapEvent.create({ data: { dailyRunId: run.id, tappedAt: now, batchSize: count } });
    if (stage !== run.stage) await tx.dailyRun.update({ where: { id: run.id }, data: { stage } });

    return { tapCount: run.tapCount, stage };
  });
}
