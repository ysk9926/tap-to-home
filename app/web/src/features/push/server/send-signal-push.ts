import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { signalMessage } from "@/features/signal/messages";
import { prisma } from "@/lib/db";
import { isPushConfigured, sendToToken } from "./fcm";
import { dropPushTokens, listPushTokens } from "./tokens";

/**
 * 퇴근 신호 푸시 (ADR 0006).
 *
 * 인앱 토스트로 이미 전달된 신호는 보내지 않는다. 판단 기준은 `readAt` 이다 —
 * Realtime 브로드캐스트가 성공하면 호출부가 markSignalsRead 로 채우고, 폴링 경로는
 * takeUnreadSignals 가 채운다. 발송 직전에 한 번 더 읽어 그 사이 읽힌 것을 거른다.
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
    where: { id: { in: signalIds }, readAt: null },
    select: { receiverId: true },
  });
  if (pending.length === 0) return;

  const receiverIds = [...new Set(pending.map((s) => s.receiverId))];
  const tokensByUser = await listPushTokens(receiverIds);
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
