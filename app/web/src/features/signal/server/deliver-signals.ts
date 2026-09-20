import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { sendSignalPush } from "@/features/push/server/send-signal-push";
import { SIGNAL_EVENT, userChannel, type SignalPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";
import type { SentSignal } from "./signals";

type DeliverSignalsInput = {
  signals: SentSignal[];
  senderName: string;
  level: SignalLevel;
  sentAt: Date;
};

export async function deliverSignals({ signals, senderName, level, sentAt }: DeliverSignalsInput): Promise<void> {
  if (signals.length === 0) return;
  const activeUsers = await prisma.user.findMany({
    where: { id: { in: [...new Set(signals.flatMap((signal) => [signal.senderId, signal.receiverId]))] }, ...ACTIVE_USER },
    select: { id: true },
  });
  const activeIds = new Set(activeUsers.map((user) => user.id));
  const deliverable = signals.filter((signal) => activeIds.has(signal.senderId) && activeIds.has(signal.receiverId));
  if (deliverable.length === 0) return;
  const sentAtIso = sentAt.toISOString();
  await Promise.allSettled(deliverable.map((signal) => {
    const payload: SignalPayload = { id: signal.id, senderName, level, sentAt: sentAtIso };
    return broadcast(userChannel(signal.receiverId), SIGNAL_EVENT, payload);
  }));
  await sendSignalPush(deliverable.map((signal) => signal.id), senderName, level);
}
