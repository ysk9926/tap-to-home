import { recordActivity } from "@/features/analytics/server/activity";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** 서버 세션과 서버 시각만 사용하며 요청 본문은 수집 근거로 읽지 않는다. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return jsonError(403, "허용되지 않은 요청이에요");
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  await recordActivity(user.id);
  return new Response(null, { status: 204 });
}
