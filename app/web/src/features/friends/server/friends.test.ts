import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { prisma } from "@/lib/db";
import { recordTaps } from "@/features/race/server/record-taps";
import { FriendError, addFriend, listFriends, searchUser } from "./friends";

const NOW = new Date("2026-09-19T03:00:00Z");
let a: { id: string; username: string };
let b: { id: string; username: string };

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("fa"), createTestUser("fb")]);
  await recordTaps(b.id, 7, NOW);
});
afterAll(async () => {
  await deleteTestUsers([a.id, b.id]);
});

describe("friends", () => {
  it("searchUser is case-insensitive and hides myself", async () => {
    expect(await searchUser(b.username.toUpperCase(), a.id)).toMatchObject({ id: b.id, username: b.username });
    expect(await searchUser(a.username, a.id)).toBeNull();
    expect(await searchUser("nobody_here_xyz", a.id)).toBeNull();
  });

  it("addFriend creates an accepted friendship visible from both sides", async () => {
    const friend = await addFriend(a.id, ` ${b.username.toUpperCase()} `, NOW);
    expect(friend).toMatchObject({ userId: b.id, username: b.username, tapCount: 7 });
    expect((await listFriends(a.id, NOW)).map((f) => f.userId)).toEqual([b.id]);
    expect((await listFriends(b.id, NOW)).map((f) => f.userId)).toEqual([a.id]);
  });

  it("rejects duplicates in either direction, self, and unknown ids", async () => {
    await expect(addFriend(b.id, a.username, NOW)).rejects.toMatchObject({ code: "already" });
    await expect(addFriend(a.id, a.username, NOW)).rejects.toMatchObject({ code: "self" });
    await expect(addFriend(a.id, "nobody_here_xyz", NOW)).rejects.toBeInstanceOf(FriendError);
  });

  it("dedupes friend ids when both directions exist (concurrent registration race)", async () => {
    await prisma.friendship.create({ data: { requesterId: b.id, addresseeId: a.id } });
    expect((await listFriends(a.id, NOW)).map((f) => f.userId)).toEqual([b.id]);
  });
});
