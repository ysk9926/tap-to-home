import "server-only";
import { prisma } from "@/lib/db";

/**
 * 계정 탈퇴 (소프트 삭제). row 와 친구 관계는 남기고 `deletedAt` 만 채운다 —
 * 조회 지점(src/lib/db/active-user.ts)이 전부 이 값을 보고 거른다.
 *
 * 세션과 푸시 토큰은 실제로 지운다. 남겨 두면 탈퇴한 계정으로 알림이 계속 가고,
 * 세션은 다음 요청에서 어차피 거부되므로 보관할 이유가 없다.
 */
export async function softDeleteAccount(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: now } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.pushToken.deleteMany({ where: { userId } }),
  ]);
}
