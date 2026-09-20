import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listFriends, searchUser } from "@/features/friends/server/friends";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { getRaceToday } from "@/features/race/server/today";
import { createTestUser, deleteTestUsers } from "../../../test/db";

let me: { id: string; name: string; username: string };
let gone: { id: string; name: string; username: string };

beforeAll(async () => {
  [me, gone] = await Promise.all([createTestUser("active"), createTestUser("gone")]);
  await prisma.friendship.create({
    data: { requesterId: me.id, addresseeId: gone.id, status: "accepted" },
  });
  await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
});
afterAll(async () => {
  await deleteTestUsers([me.id, gone.id]);
});

describe("ACTIVE_USER filter", () => {
  it("hides a deleted user from friend search", async () => {
    expect(await searchUser(gone.username, me.id)).toBeNull();
  });

  it("hides a deleted user from the friend id list", async () => {
    expect(await listFriendIds(me.id)).not.toContain(gone.id);
  });

  it("hides a deleted user from the friend list", async () => {
    const friends = await listFriends(me.id);
    expect(friends.map((f) => f.userId)).not.toContain(gone.id);
  });

  it("hides a deleted user from the race ranking", async () => {
    const race = await getRaceToday({ id: me.id, name: me.name, username: me.username });
    expect(race.racers.map((r) => r.userId)).not.toContain(gone.id);
  });
});
