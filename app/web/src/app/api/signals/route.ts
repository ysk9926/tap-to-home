import { after } from "next/server";
import type { SignalLevel } from "@/components/signal-toast";
import { SIGNAL_EVENT, userChannel, type SignalPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import { sendSignal } from "@/features/signal/server/signals";
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
  const { delivered } = await sendSignal(user.id, body.level);
  const sentAt = new Date().toISOString();
  after(() =>
    Promise.all(
      delivered.map((receiverId) => {
        const payload: SignalPayload = { id: `${user.id}:${sentAt}`, senderName: user.name, level: body.level, sentAt };
        return broadcast(userChannel(receiverId), SIGNAL_EVENT, payload);
      }),
    ),
  );
  return Response.json({ delivered: delivered.length });
}
