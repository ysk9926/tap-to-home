import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { getAdminUserDetail } from "./users";

type TestUser = Awaited<ReturnType<typeof createTestUser>>;
const users: TestUser[] = [];
let target: TestUser;
let outgoingFriend: TestUser;
let incomingFriend: TestUser;
let legacyFriend: TestUser;
let outgoingBlock: TestUser;
let incomingBlock: TestUser;
let blocker: TestUser;
let pending: TestUser;
let unrelated: TestUser;

beforeAll(async () => {
  for (const prefix of ["relowner", "relsent", "relreceived", "rellegacy", "relblockout", "relblockin", "relblocker", "relpending", "relother"]) {
    users.push(await createTestUser(prefix));
  }
  [target, outgoingFriend, incomingFriend, legacyFriend, outgoingBlock, incomingBlock, blocker, pending, unrelated] = users;
  await prisma.user.update({ where: { id: incomingFriend.id }, data: { suspendedAt: new Date() } });
  await prisma.user.update({ where: { id: legacyFriend.id }, data: { deletedAt: new Date() } });
  await prisma.user.update({ where: { id: incomingBlock.id }, data: { deletedAt: new Date() } });
  await prisma.friendship.createMany({ data: [
    { requesterId: target.id, addresseeId: outgoingFriend.id, status: "accepted", createdAt: new Date("2026-09-10T00:00:00Z"), respondedAt: new Date("2026-09-20T15:30:00Z") },
    { requesterId: incomingFriend.id, addresseeId: target.id, status: "accepted", respondedAt: new Date("2026-09-19T01:00:00Z") },
    { requesterId: target.id, addresseeId: legacyFriend.id, status: "accepted" },
    { requesterId: target.id, addresseeId: outgoingBlock.id, status: "blocked", blockedById: target.id, respondedAt: new Date("2026-09-20T16:00:00Z") },
    { requesterId: incomingBlock.id, addresseeId: target.id, status: "blocked", blockedById: target.id },
    { requesterId: target.id, addresseeId: blocker.id, status: "blocked", blockedById: blocker.id, respondedAt: new Date("2026-09-20T17:00:00Z") },
    { requesterId: pending.id, addresseeId: target.id, status: "pending" },
    { requesterId: unrelated.id, addresseeId: pending.id, status: "accepted", respondedAt: new Date("2026-09-21T00:00:00Z") },
  ] });
});

afterAll(async () => { await deleteTestUsers(users.map((user) => user.id)); });

describe("admin user relationships", () => {
  it("shows accepted friends in both directions with acceptance time and inactive account status", async () => {
    const detail = await getAdminUserDetail(target.id);
    expect(detail.friends).toEqual([
      { ...outgoingFriend, status: "active", acceptedAt: "2026-09-20T15:30:00.000Z" },
      { ...incomingFriend, status: "suspended", acceptedAt: "2026-09-19T01:00:00.000Z" },
      { ...legacyFriend, status: "deleted", acceptedAt: null },
    ]);
    expect(detail.user.friendCount).toBe(1);
  });

  it("shows only blocks made by the viewed user regardless of request direction or account status", async () => {
    const detail = await getAdminUserDetail(target.id);
    expect(detail.blockedUsers).toEqual([
      { ...outgoingBlock, status: "active", blockedAt: "2026-09-20T16:00:00.000Z" },
      { ...incomingBlock, status: "deleted", blockedAt: null },
    ]);
  });

  it("returns empty lists when there are no accepted friends or outgoing blocks", async () => {
    const detail = await getAdminUserDetail(outgoingBlock.id);
    expect(detail.friends).toEqual([]);
    expect(detail.blockedUsers).toEqual([]);
  });

  it("preserves not-found behavior for an unknown user", async () => {
    await expect(getAdminUserDetail(randomUUID())).rejects.toMatchObject({ status: 404 });
  });
});
