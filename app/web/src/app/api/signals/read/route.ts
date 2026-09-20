import { markSignalsRead } from "@/features/signal/server/signals";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const MAX_IDS = 50;
const MAX_ID_LENGTH = 128;

function validateBody(raw: unknown): { ids: string[] } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const ids = (raw as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS) return null;
  if (!ids.every((id) => typeof id === "string" && id.trim().length > 0 && id.length <= MAX_ID_LENGTH)) return null;
  return { ids };
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "신호 ID가 잘못됐어요");
  await markSignalsRead(user.id, body.ids);
  return new Response(null, { status: 204 });
}
