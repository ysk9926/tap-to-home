import { after } from "next/server";
import { RunSettledError, recordTaps } from "@/features/race/server/record-taps";
import { RACE_EVENT, userChannel, type RacePayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";
import { todayKst } from "@/lib/kst";

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
    const now = new Date();
    const date = todayKst(now);
    const result = await recordTaps(user.id, body.count, now);
    const payload: RacePayload = { userId: user.id, date, ...result };
    // 응답을 먼저 보내고 브로드캐스트 (Vercel 은 after() 완료까지 함수를 유지한다)
    after(() => broadcast(userChannel(user.id), RACE_EVENT, payload));
    return Response.json({ ...result, date });
  } catch (e) {
    if (e instanceof RunSettledError) return jsonError(409, e.message);
    throw e;
  }
}
