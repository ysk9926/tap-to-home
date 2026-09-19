import "server-only";
import { listBlocked, listFriends, listIncomingRequests, listOutgoingRequests } from "./friends";
import type { BlockedUser, FriendRequest, FriendSummary } from "./friends";

export type FriendsState = {
  friends: FriendSummary[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: BlockedUser[];
};

/** 친구 화면과 요청 다이얼로그의 초기 상태. GET /api/friends 와 같은 모양이다 */
export async function getFriendsState(userId: string, now: Date = new Date()): Promise<FriendsState> {
  const [friends, incoming, outgoing, blocked] = await Promise.all([
    listFriends(userId, now),
    listIncomingRequests(userId),
    listOutgoingRequests(userId),
    listBlocked(userId),
  ]);
  return { friends, incoming, outgoing, blocked };
}
