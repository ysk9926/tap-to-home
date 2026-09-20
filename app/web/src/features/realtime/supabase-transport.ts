"use client";

import { getSupabaseRealtime } from "@/lib/supabase/client";
import type { SyncChannel, SyncTransport } from "./session-controller";

type SupabaseRealtime = ReturnType<typeof getSupabaseRealtime>;
type SupabaseChannel = ReturnType<SupabaseRealtime["channel"]>;
type ChannelBinding = {
  client: SupabaseRealtime;
  channel: SupabaseChannel;
  topic: string;
  forget: () => void;
  inFlight?: Promise<void>;
  lastError?: unknown;
};

const pendingRemovals = new Map<SupabaseChannel, ChannelBinding>();

function statusError(topic: string, status: string): Error {
  return new Error(`Supabase realtime removal returned ${status} for ${topic}`);
}

async function removeBinding(binding: ChannelBinding): Promise<void> {
  if (binding.inFlight) return binding.inFlight;

  const attempt = (async () => {
    try {
      const status = await binding.client.removeChannel(binding.channel);
      if (status !== "ok") throw statusError(binding.topic, status);
      pendingRemovals.delete(binding.channel);
      binding.forget();
      binding.lastError = undefined;
    } catch (error) {
      binding.lastError = error;
      throw error;
    }
  })();
  binding.inFlight = attempt;

  try {
    await attempt;
  } finally {
    if (binding.inFlight === attempt) binding.inFlight = undefined;
  }
}

async function retryPendingRemovals(): Promise<void> {
  await Promise.allSettled([...pendingRemovals.values()].map(removeBinding));
}

function assertTopicAvailable(topic: string): void {
  const pending = [...pendingRemovals.values()].find((binding) => binding.topic === topic);
  if (!pending) return;

  const error = new Error(`Supabase realtime channel ${topic} has a pending removal`);
  if (pending.lastError !== undefined) Object.defineProperty(error, "cause", { value: pending.lastError });
  throw error;
}

/** SDK 자체는 싱글턴이며 실제 연결은 session.start() 이후에만 만든다. */
export function createSupabaseTransport(): SyncTransport {
  const channels = new Map<SyncChannel, ChannelBinding>();
  return {
    channel(topic) {
      assertTopicAvailable(topic);
      const client = getSupabaseRealtime();
      const channel = client.channel(topic);
      const wrapped: SyncChannel = {
        on(event, callback) {
          channel.on("broadcast", { event }, ({ payload }) => callback(payload));
          return wrapped;
        },
        subscribe(callback) { channel.subscribe(callback); },
      };
      channels.set(wrapped, {
        client,
        channel,
        topic,
        forget: () => channels.delete(wrapped),
      });
      return wrapped;
    },
    async removeChannel(wrapped) {
      const binding = channels.get(wrapped);
      if (!binding) return;
      pendingRemovals.set(binding.channel, binding);
      await removeBinding(binding);
    },
  };
}

// 사용자 교체로 서로 다른 Provider가 연속 생성돼도 이전 SDK 채널 해제를 기다린다.
let lifecycle: Promise<void> = Promise.resolve();
export function queueRealtimeLifecycle(operation: () => Promise<void>): Promise<void> {
  const next = lifecycle.then(async () => {
    await retryPendingRemovals();
    await operation();
  });
  lifecycle = next.catch(() => {});
  return next;
}
