import "server-only";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";

function validatePassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error("비밀번호는 12~128자여야 합니다");
}

export async function bootstrapMaster(rawUsername: string, password: string): Promise<boolean> {
  const username = rawUsername.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error("마스터 아이디는 영문·숫자·_ 3~30자여야 합니다");
  validatePassword(password);
  if (await prisma.adminUser.findUnique({ where: { id: "master" } })) return false;
  const hash = await hashPassword(password);
  try {
    await prisma.adminUser.create({ data: {
      id: "master", username, displayUsername: username, name: "마스터",
      email: `${username}@admin.tap-to-home.local`,
      accounts: { create: { id: randomUUID(), accountId: "master", providerId: "credential", password: hash } },
    } });
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002" &&
        await prisma.adminUser.findUnique({ where: { id: "master" } })) return false;
    throw error;
  }
}

export async function resetMasterPassword(password: string): Promise<void> {
  validatePassword(password);
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: "master" }, data: { disabledAt: null } });
    const result = await tx.adminAccount.updateMany({
      where: { userId: "master", providerId: "credential" }, data: { password: hash },
    });
    if (result.count !== 1) throw new Error("마스터 자격 증명을 확인해 주세요");
    await tx.adminSession.deleteMany({ where: { userId: "master" } });
  });
}

export async function disableMaster(): Promise<void> {
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: "master" }, data: { disabledAt: new Date() } }),
    prisma.adminSession.deleteMany({ where: { userId: "master" } }),
  ]);
}
