import { FriendError, blockUser, removeFriend } from "@/features/friends/server/friends";
import { FRIEND_ERROR_STATUS } from "@/features/friends/server/error-status";
import { notifyFriendChange } from "@/features/friends/server/notify";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

/** 친구 삭제 (F0-4) */
export async function DELETE(request: Request, ctx: RouteContext<"/api/friends/[userId]">) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const { userId } = await ctx.params;
  try {
    await removeFriend(user.id, userId);
    await notifyFriendChange(userId, "removed", user.name);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(FRIEND_ERROR_STATUS[e.code], e.message);
    throw e;
  }
}

/** 차단 (F0-4). 친구·요청 여부와 무관하게 blocked 로 수렴시킨다 */
export async function POST(request: Request, ctx: RouteContext<"/api/friends/[userId]">) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const { userId } = await ctx.params;
  try {
    await blockUser(user.id, userId);
    // 차단당한 쪽 화면에서도 상대가 사라져야 한다. 차단 사실 자체는 알리지 않는다
    await notifyFriendChange(userId, "removed", user.name);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(FRIEND_ERROR_STATUS[e.code], e.message);
    throw e;
  }
}
