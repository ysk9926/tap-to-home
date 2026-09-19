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
 * daily_run 을 upsert 하며 tap_count 를 원자적으로 올리고 tap_event 에 배치 1행을 남긴다.
 */
export async function recordTaps(
  userId: string,
  count: number,
  now: Date = new Date(),
): Promise<{ tapCount: number; stage: number }> {
  const runDate = kstDate(now);

  const settled = await prisma.dailyResult.findFirst({
    where: { dailyRun: { userId, runDate } },
    select: { dailyRunId: true },
  });
  if (settled) throw new RunSettledError();

  const run = await prisma.dailyRun.upsert({
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

  const stage = stageIndexOf(run.tapCount);
  await prisma.$transaction([
    prisma.tapEvent.create({ data: { dailyRunId: run.id, tappedAt: now, batchSize: count } }),
    ...(stage !== run.stage
      ? [prisma.dailyRun.update({ where: { id: run.id }, data: { stage } })]
      : []),
  ]);

  return { tapCount: run.tapCount, stage };
}
