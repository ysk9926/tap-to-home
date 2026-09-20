import type { SignalPayload } from "@/features/realtime/channels";
import { ApiError } from "@/lib/fetch-json";

const SIGNAL_TTL_MS = 10 * 60 * 1000;
const ACK_BATCH_MS = 100;
const ACK_BATCH_SIZE = 50;
const ACK_RETRY_MS = [1_000, 2_000] as const;

export type SignalInbox = {
  accept(signal: SignalPayload, source: "realtime" | "poll"): boolean;
  dispose(): void;
};

export type SignalInboxOptions = {
  now: () => number;
  visible: () => boolean;
  onToast: (signal: SignalPayload) => void;
  acknowledge: (ids: string[]) => Promise<void>;
};

export function createSignalInbox(options: SignalInboxOptions): SignalInbox {
  const seen = new Map<string, number>();
  const pendingAcknowledgements: string[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function pruneSeen(now: number): void {
    seen.forEach((expiresAt, id) => {
      if (expiresAt <= now) seen.delete(id);
    });
  }

  function canRetry(error: unknown): boolean {
    if (error instanceof ApiError) return error.status >= 500 && error.status < 600;
    return true;
  }

  async function acknowledgeBatch(ids: string[], retryIndex: number): Promise<void> {
    if (disposed || !options.visible()) return;
    try {
      await options.acknowledge(ids);
    } catch (error) {
      if (disposed || !options.visible() || !canRetry(error) || retryIndex >= ACK_RETRY_MS.length) return;
      schedule(() => void acknowledgeBatch(ids, retryIndex + 1), ACK_RETRY_MS[retryIndex]);
    }
  }

  function flush(): void {
    flushTimer = null;
    if (disposed || !options.visible()) {
      pendingAcknowledgements.length = 0;
      return;
    }
    while (pendingAcknowledgements.length > 0) {
      const batch = pendingAcknowledgements.splice(0, ACK_BATCH_SIZE);
      void acknowledgeBatch(batch, 0);
    }
  }

  return {
    accept(signal, source) {
      if (disposed || !options.visible()) return false;
      const now = options.now();
      const sentAt = Date.parse(signal.sentAt);
      if (Number.isFinite(sentAt) && now - sentAt > SIGNAL_TTL_MS) return false;

      pruneSeen(now);
      if (seen.has(signal.id)) return false;
      seen.set(signal.id, now + SIGNAL_TTL_MS);
      options.onToast(signal);

      if (source === "realtime") {
        pendingAcknowledgements.push(signal.id);
        if (flushTimer === null) flushTimer = schedule(flush, ACK_BATCH_MS);
      }
      return true;
    },
    dispose() {
      disposed = true;
      timers.forEach(clearTimeout);
      timers.clear();
      flushTimer = null;
      pendingAcknowledgements.length = 0;
      seen.clear();
    },
  };
}
