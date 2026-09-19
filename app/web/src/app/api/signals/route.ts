import { after } from "next/server";
import type { SignalLevel } from "@/components/signal-toast";
import { sendSignalPush } from "@/features/push/server/send-signal-push";
import { SIGNAL_EVENT, userChannel, type SignalPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import { markSignalsRead, sendSignal } from "@/features/signal/server/signals";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const LEVELS: readonly SignalLevel[] = ["normal", "strong", "urgent", "rescue"];

function validateBody(raw: unknown): { level: SignalLevel } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const level = (raw as { level?: unknown }).level;
  return LEVELS.includes(level as SignalLevel) ? { level: level as SignalLevel } : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "level 이 잘못됐어요");
  const { delivered, signals, sentAt } = await sendSignal(user.id, body.level);
  const sentAtIso = sentAt.toISOString();
  after(async () => {
    const results = await Promise.all(
      signals.map(async (signal) => {
        const payload: SignalPayload = {
          id: signal.id,
          senderName: user.name,
          level: body.level,
          sentAt: sentAtIso,
        };
        const ok = await broadcast(userChannel(signal.receiverId), SIGNAL_EVENT, payload);
        return ok ? signal.id : null;
      }),
    );
    const okIds = results.filter((id): id is string => id !== null);
    await markSignalsRead(okIds);
    // 실시간으로 못 닿은 신호만 푸시한다. 화면을 보고 있던 사람은 방금 토스트로 봤다 (ADR 0006).
    // sendSignalPush 가 readAt 을 한 번 더 확인하므로 경합에도 중복이 나지 않는다.
    const unreachedIds = signals.map((s) => s.id).filter((id) => !okIds.includes(id));
    await sendSignalPush(unreachedIds, user.name, body.level);
  });
  return Response.json({ delivered: delivered.length });
}
