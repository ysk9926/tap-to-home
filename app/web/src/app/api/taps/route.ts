import { RunSettledError, recordTaps } from "@/features/race/server/record-taps";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

// route.ts 는 핸들러 외 export 를 허용하지 않으므로 상수는 export 하지 않는다
const MAX_BATCH = 50;

function validateBody(raw: unknown): { count: number } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const count = (raw as { count?: unknown }).count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_BATCH) return null;
  return { count };
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");

  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "count 는 1~50 사이 정수여야 해요");

  try {
    return Response.json(await recordTaps(user.id, body.count));
  } catch (e) {
    if (e instanceof RunSettledError) return jsonError(409, e.message);
    throw e;
  }
}
