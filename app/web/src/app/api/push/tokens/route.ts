import { registerPushToken, unregisterPushToken } from "@/features/push/server/tokens";
import type { PushPlatform } from "@/generated/prisma/enums";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const PLATFORMS: readonly PushPlatform[] = ["ios", "android"];
/** FCM 등록 토큰은 150자 안팎. 넉넉히 잡되 무한정 받지는 않는다 */
const MAX_TOKEN_LENGTH = 4096;

type Body = { token: string; platform: PushPlatform };

function validateBody(raw: unknown): Body | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { token, platform } = raw as { token?: unknown; platform?: unknown };
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;
  if (!PLATFORMS.includes(platform as PushPlatform)) return null;
  return { token, platform: platform as PushPlatform };
}

/** 앱이 실행될 때마다 토큰을 올린다 (ADR 0006) */
export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "token 이나 platform 이 잘못됐어요");
  await registerPushToken(user.id, body.token, body.platform);
  return Response.json({ ok: true });
}

/** 로그아웃할 때 이 기기 토큰만 지운다 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "token 이 잘못됐어요");
  await unregisterPushToken(user.id, body.token);
  return Response.json({ ok: true });
}
