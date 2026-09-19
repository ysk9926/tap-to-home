import { FriendError, requestFriend } from "@/features/friends/server/friends";
import { getFriendsState } from "@/features/friends/server/friends-state";
import { FRIEND_ERROR_STATUS } from "@/features/friends/server/error-status";
import { notifyFriendChange } from "@/features/friends/server/notify";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

function validateBody(raw: unknown): { username: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const username = (raw as { username?: unknown }).username;
  return typeof username === "string" && username.trim().length > 0 ? { username } : null;
}

/** 친구 화면이 쓰는 상태 전체. 목록 넷을 한 번에 내려 화면이 한 번만 요청하게 한다 */
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json(await getFriendsState(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "아이디를 입력해 주세요");
  try {
    const result = await requestFriend(user.id, body.username);
    const targetId = result.kind === "requested" ? result.request.user.id : result.friend.userId;
    await notifyFriendChange(targetId, result.kind === "requested" ? "requested" : "accepted", user.name);
    return Response.json(result);
  } catch (e) {
    if (e instanceof FriendError) return jsonError(FRIEND_ERROR_STATUS[e.code], e.message);
    throw e;
  }
}
