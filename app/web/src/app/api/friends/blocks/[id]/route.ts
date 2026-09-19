import { FriendError, unblockUser } from "@/features/friends/server/friends";
import { FRIEND_ERROR_STATUS } from "@/features/friends/server/error-status";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

/** 차단 해제 (F0-4). 차단한 사람만 풀 수 있다 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/friends/blocks/[id]">) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const { id } = await ctx.params;
  try {
    await unblockUser(user.id, id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(FRIEND_ERROR_STATUS[e.code], e.message);
    throw e;
  }
}
