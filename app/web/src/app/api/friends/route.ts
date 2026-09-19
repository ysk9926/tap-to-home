import { FriendError, addFriend, listFriends } from "@/features/friends/server/friends";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const STATUS: Record<FriendError["code"], number> = { self: 400, not_found: 404, already: 409 };

function validateBody(raw: unknown): { username: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const username = (raw as { username?: unknown }).username;
  return typeof username === "string" && username.trim().length > 0 ? { username } : null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json({ friends: await listFriends(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "아이디를 입력해 주세요");
  try {
    return Response.json({ friend: await addFriend(user.id, body.username) });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(STATUS[e.code], e.message);
    throw e;
  }
}
