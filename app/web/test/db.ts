import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { placeholderEmail } from "@/lib/auth/placeholder-email";

/** 통합 테스트용 사용자. 삭제하면 FK cascade 로 run/signal/friendship 이 함께 지워진다 */
export async function createTestUser(prefix: string): Promise<{ id: string; name: string; username: string }> {
  const id = randomUUID();
  const username = `${prefix}_${id.slice(0, 8)}`;
  const user = await prisma.user.create({
    data: { id, name: prefix, username, displayUsername: username, email: placeholderEmail(username) },
    select: { id: true, name: true },
  });
  return { id: user.id, name: user.name, username };
}

export async function deleteTestUsers(ids: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
