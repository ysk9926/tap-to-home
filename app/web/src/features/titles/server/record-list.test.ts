import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { settleRun } from "./settle";
import { getRecordDetail, listRecords } from "./record-list";

const DAY = new Date("2026-09-18T08:30:00Z"); // 17:30 KST 09-18
const NOW = new Date("2026-09-20T03:00:00Z"); // 12:00 KST 09-20
let me: { id: string; name: string; username: string };

beforeAll(async () => {
  me = await createTestUser("rec");
  await recordTaps(me.id, 1200, DAY);
  await settleRun({ id: me.id, name: me.name, username: me.username }, kstDate(DAY), NOW);
});
afterAll(async () => {
  await deleteTestUsers([me.id]);
});

describe("listRecords", () => {
  it("returns settled days newest first", async () => {
    const records = await listRecords(me.id, NOW);
    expect(records[0]).toMatchObject({ date: "2026-09-18", total: 1200, rank: 1 });
    expect(records[0].hasNew).toBe(true);
  });
});

describe("getRecordDetail", () => {
  it("records an actual detail view once, separately from notification seenAt", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId: me.id, runDate: kstDate(DAY) } },
    });
    await prisma.dailyResult.update({ where: { dailyRunId: run.id }, data: { seenAt: NOW } });

    const detail = await getRecordDetail(user, "2026-09-18");
    await getRecordDetail(user, "2026-09-18");
    expect(detail?.total).toBe(1200);
    expect(detail?.result).not.toBeNull();

    expect(await prisma.productEvent.findMany({
      where: { userId: me.id, type: "result_viewed", entityId: run.id },
      select: { dedupeKey: true },
    })).toEqual([{ dedupeKey: `result_viewed:${me.id}:${run.id}` }]);
    expect((await prisma.dailyResult.findUniqueOrThrow({ where: { dailyRunId: run.id } })).seenAt).toEqual(NOW);
  });

  it("returns null for an unsettled or malformed date", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    expect(await getRecordDetail(user, "2026-01-01")).toBeNull();
    expect(await getRecordDetail(user, "not-a-date")).toBeNull();
  });

  it("does not write view state for a suspended member", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    await prisma.user.update({ where: { id: me.id }, data: { suspendedAt: NOW } });
    try {
      await expect(getRecordDetail(user, "2026-09-18")).resolves.toBeNull();
    } finally {
      await prisma.user.update({ where: { id: me.id }, data: { suspendedAt: null } });
    }
  });
});
