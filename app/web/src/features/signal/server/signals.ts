import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { prisma } from "@/lib/db";

/** 같은 등급은 같은 상대에게 10분에 한 번 (F2) */
export const SIGNAL_COOLDOWN_MS = 10 * 60 * 1000;
/** 이보다 오래된 미읽음 신호는 토스트로 띄우지 않는다 */
export const UNREAD_WINDOW_MS = 10 * 60 * 1000;

export type UnreadSignal = { id: string; senderName: string; level: SignalLevel; sentAt: string };
export type SentSignal = { id: string; receiverId: string };

export async function sendSignal(
  senderId: string,
  level: SignalLevel,
  now: Date = new Date(),
): Promise<{ delivered: string[]; signals: SentSignal[]; sentAt: Date }> {
  const friendIds = await listFriendIds(senderId);
  if (friendIds.length === 0) return { delivered: [], signals: [], sentAt: now };

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
  if (delivered.length === 0) return { delivered, signals: [], sentAt: now };

  const signals = await prisma.signal.createManyAndReturn({
    data: delivered.map((receiverId) => ({ senderId, receiverId, level, sentAt: now })),
    select: { id: true, receiverId: true },
  });
  return { delivered, signals, sentAt: now };
}

/**
 * 신호를 읽음 처리한다. 실시간 경로에서 브로드캐스트가 성공한 직후 호출해, 그 신호가
 * 폴링 경로(takeUnreadSignals)로 다시 도착해 중복 토스트를 띄우지 않게 한다.
 */
export async function markSignalsRead(ids: string[], now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return;
  await prisma.signal.updateMany({ where: { id: { in: ids } }, data: { readAt: now } });
}

/**
 * 최근 10분 내 미읽음 신호를 돌려주고 같은 호출 안에서 바로 읽음 처리한다. 폴링 단계의
 * 토스트 소스. 응답을 클라이언트가 받기 전에 이미 읽음 처리되므로, 응답이 유실되면(네트워크
 * 오류 등) 그 토스트는 다시 뜨지 않는다 — 신호는 사라져도 되는 알림이라는 전제 하의
 * at-most-once 동작이다(Task 8 판단). 실시간 경로는 이 함수 대신, 브로드캐스트 성공 후
 * markSignalsRead 로 읽음 처리한다.
 */
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
