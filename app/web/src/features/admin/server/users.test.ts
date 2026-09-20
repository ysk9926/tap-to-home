import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { listAdminUsers, getAdminUserDetail, moderateUser, listAdminAudit } from "./users";

let target: Awaited<ReturnType<typeof createTestUser>>;
let friend: Awaited<ReturnType<typeof createTestUser>>;
let ownMaster = false;
const marker = `mod_${randomUUID().slice(0, 8)}`;
beforeAll(async () => {
  if (await prisma.adminUser.findUnique({ where: { id: "master" } })) throw new Error("Use a test DB without a provisioned master");
  await prisma.adminUser.create({ data: { id: "master", name: "테스트 운영자", email: `${marker}@test.local`, username: marker } });
  ownMaster = true;
  target = await createTestUser("admuser");
  friend = await createTestUser("admfriend");
  await prisma.friendship.create({ data: { requesterId: target.id, addresseeId: friend.id, status: "accepted" } });
});
afterAll(async () => {
  const ids = [target?.id, friend?.id].filter((id): id is string => Boolean(id));
  await prisma.adminAuditLog.deleteMany({ where: { targetUserId: { in: ids } } });
  await deleteTestUsers(ids);
  if (ownMaster) await prisma.adminUser.deleteMany({ where: { id: "master", username: marker } });
});

describe("admin user management", () => {
  it("searches members without leaking credentials or including master identity", async () => {
    const result = await listAdminUsers(new URLSearchParams({ q: target.id }));
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toMatchObject({ id: target.id, status: "active", friendCount: 1 });
    expect(result.users[0]).not.toHaveProperty("email");
    expect((await listAdminUsers(new URLSearchParams({ q: marker }))).users).toEqual([]);
  });
  it("suspends atomically with session/token removal and a recorded reason", async () => {
    await prisma.session.create({ data: { id: randomUUID(), token: randomUUID(), userId: target.id, expiresAt: new Date(Date.now() + 86400000) } });
    await prisma.pushToken.create({ data: { userId: target.id, token: randomUUID(), platform: "ios" } });
    await moderateUser("master", target.id, "suspend", { reason: "운영 정책 위반 확인" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).suspendedAt).not.toBeNull();
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.pushToken.count({ where: { userId: target.id } })).toBe(0);
    const audit = await listAdminAudit(new URLSearchParams({ targetUserId: target.id }));
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]).toMatchObject({ action: "suspend", reason: "운영 정책 위반 확인" });
  });
  it("unsuspends without restoring old sessions and can exclude analytics with audit", async () => {
    await moderateUser("master", target.id, "unsuspend", { reason: "소명 확인 완료" });
    await moderateUser("master", target.id, "analytics-exclusion", { reason: "운영 테스트 계정", excluded: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.suspendedAt).toBeNull();
    expect(user.analyticsExcluded).toBe(true);
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
  });
  it("rejects invalid reasons and disabled actors without side effects", async () => {
    const before = await prisma.adminAuditLog.count({ where: { targetUserId: target.id } });
    await expect(moderateUser("master", target.id, "suspend", { reason: "" })).rejects.toMatchObject({ status: 400 });
    await prisma.adminUser.update({ where: { id: "master" }, data: { disabledAt: new Date() } });
    await expect(moderateUser("master", target.id, "suspend", { reason: "거절되어야 하는 요청" })).rejects.toMatchObject({ status: 403 });
    expect(await prisma.adminAuditLog.count({ where: { targetUserId: target.id } })).toBe(before);
    await prisma.adminUser.update({ where: { id: "master" }, data: { disabledAt: null } });
  });
  it("detail reads do not mark settlements as seen or create visits", async () => {
    const run = await prisma.dailyRun.create({ data: {
      userId: target.id, runDate: new Date("2020-01-01"), tapCount: 100,
      result: { create: { rank: 1, rankTotal: 1, titleIds: [] } },
    } });
    expect((await getAdminUserDetail(target.id)).user.id).toBe(target.id);
    expect((await prisma.dailyResult.findUniqueOrThrow({ where: { dailyRunId: run.id } })).seenAt).toBeNull();
    expect(await prisma.userDailyActivity.count({ where: { userId: target.id } })).toBe(0);
  });
  it("rejects unknown filters and master as a moderation target", async () => {
    await expect(listAdminUsers(new URLSearchParams({ pageSize: "1000" }))).rejects.toMatchObject({ status: 400 });
    await expect(listAdminUsers(new URLSearchParams({ status: "invented" }))).rejects.toMatchObject({ status: 400 });
    await expect(moderateUser("master", "master", "suspend", { reason: "잘못된 대상" })).rejects.toMatchObject({ status: 404 });
  });
});
