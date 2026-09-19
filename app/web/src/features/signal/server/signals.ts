import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { prisma } from "@/lib/db";

/** 같은 등급은 같은 상대에게 10분에 한 번 (F2) */
export const SIGNAL_COOLDOWN_MS = 10 * 60 * 1000;
/** 이보다 오래된 미읽음 신호는 토스트로 띄우지 않는다 */
export const UNREAD_WINDOW_MS = 10 * 60 * 1000;

export type UnreadSignal = { id: string; senderName: string; level: SignalLevel; sentAt: string };

export async function sendSignal(
  senderId: string,
  level: SignalLevel,
  now: Date = new Date(),
): Promise<{ delivered: string[] }> {
  const friendIds = await listFriendIds(senderId);
  if (friendIds.length === 0) return { delivered: [] };

  const recent = await prisma.signal.findMany({
    where: {
      senderId,
      level,
      receiverId: { in: friendIds },
      sentAt: { gt: new Date(now.getTime() - SIGNAL_COOLDOWN_MS) },
    },
    select: { receiverId: true },
  });
  const cooling = new Set(recent.map((r) => r.receiverId));
  const delivered = friendIds.filter((id) => !cooling.has(id));
  if (delivered.length === 0) return { delivered };

  await prisma.signal.createMany({
    data: delivered.map((receiverId) => ({ senderId, receiverId, level, sentAt: now })),
  });
  return { delivered };
}

/** 최근 10분 내 미읽음 신호를 돌려주고 읽음 처리한다. 폴링 단계의 토스트 소스 */
export async function takeUnreadSignals(receiverId: string, now: Date = new Date()): Promise<UnreadSignal[]> {
  const rows = await prisma.signal.findMany({
    where: { receiverId, readAt: null, sentAt: { gt: new Date(now.getTime() - UNREAD_WINDOW_MS) } },
    orderBy: { sentAt: "asc" },
    select: { id: true, level: true, sentAt: true, sender: { select: { name: true } } },
  });
  if (rows.length === 0) return [];
  await prisma.signal.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { readAt: now } });
  return rows.map((r) => ({ id: r.id, senderName: r.sender.name, level: r.level, sentAt: r.sentAt.toISOString() }));
}
