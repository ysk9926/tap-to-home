import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { recordTaps } from "./record-taps";
import { getRaceToday } from "./today";

const NOW = new Date("2026-09-19T02:00:00Z");
let me: { id: string; name: string; username: string };
let friend: { id: string; name: string; username: string };
let stranger: { id: string; name: string; username: string };

beforeAll(async () => {
  [me, friend, stranger] = await Promise.all([
    createTestUser("me"),
    createTestUser("friend"),
    createTestUser("stranger"),
  ]);
  await prisma.friendship.create({ data: { requesterId: friend.id, addresseeId: me.id, status: "accepted" } });
  await recordTaps(friend.id, 100, NOW);
  await recordTaps(stranger.id, 99, NOW);
});
afterAll(async () => {
  await deleteTestUsers([me.id, friend.id, stranger.id]);
});

describe("getRaceToday", () => {
  it("returns me (0 taps, no run yet) and accepted friends only, ranked", async () => {
    const data = await getRaceToday({ id: me.id, name: me.name, username: me.username }, NOW);
    expect(data.date).toBe("2026-09-19");
    expect(data.settled).toBe(false);
    expect(data.me).toMatchObject({ userId: me.id, tapCount: 0, stage: 0, isMe: true });
    expect(data.racers.map((r) => r.userId)).toEqual([friend.id, me.id]);
    expect(data.racers[0]).toMatchObject({ tapCount: 100, stage: 2, isMe: false, username: friend.username });
  });
});
