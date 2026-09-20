import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { sendSignalPush } from "@/features/push/server/send-signal-push";
import { SIGNAL_EVENT, userChannel, type SignalPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import type { SentSignal } from "./signals";

type DeliverSignalsInput = {
  signals: SentSignal[];
  senderName: string;
  level: SignalLevel;
  sentAt: Date;
};

export async function deliverSignals({ signals, senderName, level, sentAt }: DeliverSignalsInput): Promise<void> {
  const sentAtIso = sentAt.toISOString();
  await Promise.allSettled(signals.map((signal) => {
    const payload: SignalPayload = { id: signal.id, senderName, level, sentAt: sentAtIso };
    return broadcast(userChannel(signal.receiverId), SIGNAL_EVENT, payload);
  }));
  await sendSignalPush(signals.map((signal) => signal.id), senderName, level);
}
