import "server-only";
import { FRIEND_EVENT, userChannel, type FriendPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";

/**
 * 친구 관계 변화를 상대 채널로 알린다 (F0-3). 실패해도 삼킨다 —
 * 화면은 폴링으로도 같은 상태에 도달한다.
 */
export async function notifyFriendChange(
  targetUserId: string,
  kind: FriendPayload["kind"],
  actorName: string,
): Promise<void> {
  await broadcast(userChannel(targetUserId), FRIEND_EVENT, { kind, actorName } satisfies FriendPayload);
}
