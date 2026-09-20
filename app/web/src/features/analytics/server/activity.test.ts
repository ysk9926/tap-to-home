import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { recordActivity } from "./activity";

const FIRST_SEEN = new Date("2026-09-20T14:50:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-09-20T15:00:01.000Z");
let userId: string;
let suspendedId: string;
let excludedId: string;

beforeAll(async () => {
  [userId, suspendedId, excludedId] = (await Promise.all([
    createTestUser("activity"),
    createTestUser("activity-suspended"),
    createTestUser("activity-excluded"),
  ])).map((user) => user.id);
  await prisma.user.update({ where: { id: suspendedId }, data: { suspendedAt: FIRST_SEEN } });
  await prisma.user.update({ where: { id: excludedId }, data: { analyticsExcluded: true } });
});

afterAll(async () => {
  await deleteTestUsers([userId, suspendedId, excludedId]);
});

describe("recordActivity", () => {
  it("keeps one row per KST day and preserves the first observation", async () => {
    await Promise.all(Array.from({ length: 4 }, () => recordActivity(userId, FIRST_SEEN)));
    await recordActivity(userId, new Date(FIRST_SEEN.getTime() + 4 * 60_000));

    const rows = await prisma.userDailyActivity.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      activityDate: kstDate(FIRST_SEEN),
      firstSeenAt: FIRST_SEEN,
      lastSeenAt: FIRST_SEEN,
    });
  });

  it("updates after five minutes and creates the new KST day immediately", async () => {
    const later = new Date(FIRST_SEEN.getTime() + 5 * 60_000);
    await recordActivity(userId, later);
    await recordActivity(userId, AFTER_MIDNIGHT);

    const rows = await prisma.userDailyActivity.findMany({
      where: { userId },
      orderBy: { activityDate: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].lastSeenAt).toEqual(later);
    expect(rows[1]).toMatchObject({
      activityDate: kstDate(AFTER_MIDNIGHT),
      firstSeenAt: AFTER_MIDNIGHT,
      lastSeenAt: AFTER_MIDNIGHT,
    });
  });

  it("does not collect suspended members", async () => {
    await expect(recordActivity(suspendedId, AFTER_MIDNIGHT)).resolves.toBe(false);
    expect(await prisma.userDailyActivity.count({ where: { userId: suspendedId } })).toBe(0);
  });

  it("collects an analytics-excluded active member so exclusion stays a query-time policy", async () => {
    await expect(recordActivity(excludedId, AFTER_MIDNIGHT)).resolves.toBe(true);
    expect(await prisma.userDailyActivity.count({ where: { userId: excludedId } })).toBe(1);
  });
});
