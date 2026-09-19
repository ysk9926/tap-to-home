import { searchUser } from "@/features/friends/server/friends";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const username = new URL(request.url).searchParams.get("username") ?? "";
  return Response.json({ user: await searchUser(username, user.id) });
}
