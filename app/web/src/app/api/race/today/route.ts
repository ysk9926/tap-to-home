import { getRaceToday } from "@/features/race/server/today";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json(await getRaceToday(user));
}
