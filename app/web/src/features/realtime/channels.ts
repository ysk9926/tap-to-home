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
export const FRIEND_EVENT = "friend";

export type RacePayload = { userId: string; date: string; tapCount: number; stage: number };
export type SignalPayload = { id: string; senderName: string; level: SignalLevel; sentAt: string };
/**
 * 친구 관계가 바뀌었다는 알림 (F0-3). 상대 채널로 쏜다.
 * `requested` 는 받는 쪽이 다이얼로그를 띄우는 신호, 나머지는 목록을 다시 불러오라는 신호다.
 * 페이로드에 관계 데이터를 싣지 않고 refetch 로 맞춘다 — 목록 조회가 단일 진실이다.
 */
export type FriendPayload = { kind: "requested" | "accepted" | "removed"; actorName: string };
