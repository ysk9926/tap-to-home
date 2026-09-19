import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { RunSettledError, recordTaps } from "./record-taps";

const NOW = new Date("2026-09-19T01:00:00Z"); // 10:00 KST
let userId: string;

beforeAll(async () => {
  userId = (await createTestUser("taps")).id;
});
afterAll(async () => {
  await deleteTestUsers([userId]);
});

describe("recordTaps", () => {
  it("creates today's run on first batch and sets firstTapAt", async () => {
    const r = await recordTaps(userId, 3, NOW);
    expect(r).toEqual({ tapCount: 3, stage: 0 });
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
      include: { tapEvents: true },
    });
    expect(run.firstTapAt).toEqual(NOW);
    expect(run.tapEvents).toHaveLength(1);
    expect(run.tapEvents[0].batchSize).toBe(3);
  });

  it("increments atomically and advances stage", async () => {
    const later = new Date(NOW.getTime() + 60_000);
    const r = await recordTaps(userId, 8, later);
    expect(r).toEqual({ tapCount: 11, stage: 1 });
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
    });
    expect(run.stage).toBe(1);
    expect(run.firstTapAt).toEqual(NOW);
    expect(run.lastTapAt).toEqual(later);
  });

  it("rejects after the day is settled", async () => {
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
    });
    await prisma.dailyResult.create({
      data: { dailyRunId: run.id, titleIds: [], rank: 1, rankTotal: 1 },
    });
    await expect(recordTaps(userId, 1, NOW)).rejects.toBeInstanceOf(RunSettledError);

    const afterRejected = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
    });
    expect(afterRejected.tapCount).toBe(11); // 증가분이 롤백되어 그대로
  });
});
