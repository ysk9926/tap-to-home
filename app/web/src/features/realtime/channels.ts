import type { SignalLevel } from "@/components/signal-toast";

/**
 * 사용자당 채널 하나 (docs/decisions/0002). 내 채널에는 내 race 갱신과 나에게 온 signal 이 흐른다.
 * 클라이언트는 내 채널 + 친구 채널을 구독한다. 개방형 데모라 public 채널.
 */
export function userChannel(userId: string): string {
  return `u:${userId}`;
}

export const RACE_EVENT = "race";
export const SIGNAL_EVENT = "signal";

export type RacePayload = { userId: string; date: string; tapCount: number; stage: number };
export type SignalPayload = { id: string; senderName: string; level: SignalLevel; sentAt: string };
