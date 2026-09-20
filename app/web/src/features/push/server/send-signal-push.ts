import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { signalMessage } from "@/features/signal/messages";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";
import { isPushConfigured, sendToToken } from "./fcm";
import { dropPushTokens, listPushTokens } from "./tokens";

/**
 * 퇴근 신호 푸시 (ADR 0006).
 *
 * 푸시 발송 전에 수신 확인된 신호는 보내지 않는다. 판단 기준은 `readAt` 이다 — 보이는
 * 화면에서 실시간 신호를 표시한 클라이언트의 확인 또는 폴링 경로의 takeUnreadSignals 가
 * 채운다. 확인과 푸시 발송이 경합하면 두 경로 모두 도착할 수 있다(ADR 0006).
 *
 * 실패는 로그만 남긴다. 신호 자체는 이미 저장됐고 인앱 경로가 따로 있다.
 */
export async function sendSignalPush(
  signalIds: string[],
  senderName: string,
  level: SignalLevel,
): Promise<void> {
  if (signalIds.length === 0 || !isPushConfigured()) return;

  // 아직 안 읽힌 신호만. 그 사이 인앱으로 봤으면 푸시하지 않는다
  const pending = await prisma.signal.findMany({
    where: { id: { in: signalIds }, readAt: null, sender: ACTIVE_USER, receiver: ACTIVE_USER },
    select: { receiverId: true },
  });
  if (pending.length === 0) return;

  const receiverIds = [...new Set(pending.map((s) => s.receiverId))];
  // 알림을 끈 사람에게는 보내지 않는다 (/my/profile). 인앱 토스트는 이 설정과 무관하다
  const optedIn = await prisma.user.findMany({
    where: { id: { in: receiverIds }, notifySignal: true, ...ACTIVE_USER },
    select: { id: true },
  });
  if (optedIn.length === 0) return;

  const tokensByUser = await listPushTokens(optedIn.map((u) => u.id));
  if (tokensByUser.size === 0) return;

  const { suffix } = signalMessage(senderName, level);
  const message = { title: senderName, body: suffix, path: "/" };

  const dead: string[] = [];
  await Promise.all(
    [...tokensByUser.values()].flat().map(async (token) => {
      const outcome = await sendToToken(token, message);
      if (outcome === "unregistered") dead.push(token);
    }),
  );

  await dropPushTokens(dead);
}
