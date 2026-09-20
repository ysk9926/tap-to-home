import "server-only";
import type { PushPlatform } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";

/**
 * 앱이 실행될 때마다 토큰을 올린다. 같은 토큰이 다른 계정에서 올라오면 소유자를 바꾼다
 * (기기를 물려주거나 한 기기에서 계정을 갈아탄 경우). ADR 0006.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: PushPlatform,
): Promise<void> {
  const active = await prisma.user.findFirst({ where: { id: userId, ...ACTIVE_USER }, select: { id: true } });
  if (!active) return;
  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}

/** 로그아웃할 때 이 기기의 토큰만 지운다. 다른 기기 알림은 계속 가야 한다 */
export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { userId, token } });
}

/** 발송이 UNREGISTERED 를 돌려준 토큰을 정리한다 */
export async function dropPushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
}

export async function listPushTokens(userIds: string[]): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.pushToken.findMany({
    where: { userId: { in: userIds }, user: ACTIVE_USER },
    select: { userId: true, token: true },
  });
  const byUser = new Map<string, string[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId);
    if (list) list.push(row.token);
    else byUser.set(row.userId, [row.token]);
  }
  return byUser;
}
