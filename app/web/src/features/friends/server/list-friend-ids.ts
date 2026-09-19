import "server-only";
import { prisma } from "@/lib/db";

/**
 * accepted 친구의 userId. 양방향.
 * 동시 등록 경합 시 A→B, B→A 두 row 가 함께 존재할 수 있어 중복을 제거해 반환한다.
 */
export async function listFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return [...new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)))];
}
