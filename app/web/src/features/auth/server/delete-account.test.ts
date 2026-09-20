import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { softDeleteAccount } from "./delete-account";

let me: { id: string; username: string };

beforeAll(async () => {
  me = await createTestUser("del");
  await prisma.pushToken.create({
    data: { userId: me.id, token: `tok_${me.id}`, platform: "ios" },
  });
});
afterAll(async () => {
  await deleteTestUsers([me.id]);
});

describe("softDeleteAccount", () => {
  it("marks the user deleted and clears sessions and push tokens", async () => {
    await softDeleteAccount(me.id);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { deletedAt: true, username: true },
    });
    expect(user.deletedAt).not.toBeNull();
    // 아이디는 남아 있어 재사용할 수 없다
    expect(user.username).toBe(me.username);

    expect(await prisma.session.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.pushToken.count({ where: { userId: me.id } })).toBe(0);
  });
});
