import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { settleAllForDate } from "./settle-batch";

const YESTERDAY = new Date("2026-09-19T08:30:00Z"); // 17:30 KST 09-19
const AFTER_MIDNIGHT = new Date("2026-09-19T15:05:00Z"); // 00:05 KST 09-20
const RUN_DATE = kstDate(YESTERDAY);

let tapped: { id: string };
let idle: { id: string };
let suspended: { id: string };

beforeAll(async () => {
  [tapped, idle, suspended] = await Promise.all([
    createTestUser("btap"),
    createTestUser("bidle"),
    createTestUser("bsuspended"),
  ]);
  await recordTaps(tapped.id, 1200, YESTERDAY);
  await recordTaps(suspended.id, 1200, YESTERDAY);
  await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: AFTER_MIDNIGHT } });
  // idle 은 run 행만 있고 탭이 0인 상태를 만든다
  await prisma.dailyRun.create({ data: { userId: idle.id, runDate: RUN_DATE } });
});
afterAll(async () => {
  await deleteTestUsers([tapped.id, idle.id, suspended.id]);
});

describe("settleAllForDate", () => {
  it("settles users who tapped and skips users who did not", async () => {
    const report = await settleAllForDate(RUN_DATE, AFTER_MIDNIGHT);
    expect(report.runDate).toBe("2026-09-19");
    expect(report.failed).toEqual([]);

    const settled = await prisma.dailyResult.findFirst({
      where: { dailyRun: { userId: tapped.id, runDate: RUN_DATE } },
    });
    expect(settled).not.toBeNull();

    const skipped = await prisma.dailyResult.findFirst({
      where: { dailyRun: { userId: idle.id, runDate: RUN_DATE } },
    });
    expect(skipped).toBeNull();
    expect(await prisma.dailyResult.findFirst({
      where: { dailyRun: { userId: suspended.id, runDate: RUN_DATE } },
    })).toBeNull();
  });

  it("is safe to run twice", async () => {
    const again = await settleAllForDate(RUN_DATE, AFTER_MIDNIGHT);
    // 이미 정산된 run 은 대상에서 빠진다
    expect(again.targeted).toBe(0);
    expect(again.settled).toBe(0);

    const rows = await prisma.dailyResult.count({
      where: { dailyRun: { userId: tapped.id, runDate: RUN_DATE } },
    });
    expect(rows).toBe(1);
  });
});
