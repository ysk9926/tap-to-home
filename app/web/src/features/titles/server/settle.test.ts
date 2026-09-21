import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps, RunSettledError } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { getCollection } from "./collection";
import { settleRun, settleToday } from "./settle";
import { getTodaySummary } from "./today-summary";

const MORNING = new Date("2026-09-19T00:00:00Z"); // 09:00 KST
const EVENING = new Date("2026-09-19T08:30:00Z"); // 17:30 KST
let me: { id: string; name: string; username: string };
let friend: { id: string };

beforeAll(async () => {
  [me, friend] = await Promise.all([createTestUser("settle"), createTestUser("sf")]);
  await prisma.friendship.create({ data: { requesterId: me.id, addresseeId: friend.id, status: "accepted" } });
  await recordTaps(me.id, 1, MORNING);
  await recordTaps(me.id, 4999, EVENING);
  // Historical runs above today's cap are retained and still participate in rankings.
  await prisma.dailyRun.create({
    data: {
      userId: friend.id, runDate: kstDate(EVENING), tapCount: 15000, stage: 5,
      firstTapAt: EVENING, lastTapAt: EVENING,
      tapEvents: { create: { batchSize: 15000, tappedAt: EVENING } },
    },
  });
});
afterAll(async () => {
  await deleteTestUsers([me.id, friend.id]);
});

describe("settleToday", () => {
  it("awards titles, writes user_title and daily_result, ranks among friends", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    const r = await settleToday(user, EVENING);
    expect(r.alreadySettled).toBe(false);
    expect(r.titleIds).toEqual(
      expect.arrayContaining(["early_leaver", "post_lunch_slump", "last_hour_sprinter", "heart_already_home"]),
    );
    expect(r.primaryTitleId).toBe("heart_already_home");
    expect(r.newTitleIds).toEqual(r.titleIds); // 전부 처음
    expect(r).toMatchObject({ rank: 2, rankTotal: 2 });

    const result = await prisma.dailyResult.findFirstOrThrow({ where: { dailyRun: { userId: me.id, runDate: kstDate(EVENING) } } });
    expect(result.primaryTitleId).toBe("heart_already_home");

    const again = await settleToday(user, EVENING);
    expect(again.alreadySettled).toBe(true);
    expect(again.titleIds).toEqual(r.titleIds);
  });

  it("today summary and collection reflect the settlement", async () => {
    const summary = await getTodaySummary({ id: me.id, name: me.name, username: me.username }, EVENING);
    expect(summary).toMatchObject({ total: 5000, rank: 2, rankTotal: 2, peakHour: 17 });
    expect(summary.firstTapAt).toBe("09:00");
    expect(summary.result?.primaryTitleId).toBe("heart_already_home");

    const collection = await getCollection(me.id, EVENING);
    expect(collection.total).toBe(5);
    expect(collection.earned).toBe(4);
    expect(collection.items.find((i) => i.def.id === "heart_already_home")).toMatchObject({ earned: true, isNew: true });
    expect(collection.items.find((i) => i.def.id === "bearable_day")).toMatchObject({ earned: false, isNew: false });
  });

  it("rejects further taps after settlement, agreeing with recordTaps on 'settled'", async () => {
    await expect(recordTaps(me.id, 1, EVENING)).rejects.toBeInstanceOf(RunSettledError);
  });

  it("settles a given date and ranks by that date's taps", async () => {
    const other = await createTestUser("settleday");
    try {
      const user = { id: other.id, name: other.name, username: other.username };
      await recordTaps(other.id, 1200, MORNING);
      // 자정을 넘긴 시각에 어제(MORNING 이 속한 날) 를 정산한다
      const afterMidnight = new Date("2026-09-19T16:00:00Z"); // 09-20 01:00 KST
      const r = await settleRun(user, kstDate(MORNING), afterMidnight);
      expect(r.alreadySettled).toBe(false);
      expect(r.rankTotal).toBe(1);

      const saved = await prisma.dailyResult.findFirstOrThrow({
        where: { dailyRun: { userId: other.id, runDate: kstDate(MORNING) } },
      });
      expect(saved.rank).toBe(1);
    } finally {
      await deleteTestUsers([other.id]);
    }
  });
});
