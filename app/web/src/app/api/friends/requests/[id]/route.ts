import {
  FriendError,
  acceptRequest,
  cancelRequest,
  declineRequest,
} from "@/features/friends/server/friends";
import { notifyFriendChange } from "@/features/friends/server/notify";
import { FRIEND_ERROR_STATUS } from "@/features/friends/server/error-status";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

type Action = "accept" | "decline" | "cancel";
const ACTIONS: Action[] = ["accept", "decline", "cancel"];

function validateBody(raw: unknown): { action: Action } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const action = (raw as { action?: unknown }).action;
  return ACTIONS.includes(action as Action) ? { action: action as Action } : null;
}

/** 받은 요청 수락·거절, 보낸 요청 취소 (F0-2, F0-3). 권한은 서비스 함수가 row 조건으로 판별한다 */
export async function POST(request: Request, ctx: RouteContext<"/api/friends/requests/[id]">) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "처리할 동작이 없어요");
  const { id } = await ctx.params;

  try {
    if (body.action === "accept") {
      const friend = await acceptRequest(user.id, id);
      // 수락은 요청을 보낸 쪽에 알린다. 거절은 알리지 않는다 (F0-3)
      await notifyFriendChange(friend.userId, "accepted", user.name);
      return Response.json({ friend });
    }
    if (body.action === "decline") await declineRequest(user.id, id);
    else await cancelRequest(user.id, id);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(FRIEND_ERROR_STATUS[e.code], e.message);
    throw e;
  }
}
