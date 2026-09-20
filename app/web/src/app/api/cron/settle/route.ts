import { settleAllForDate } from "@/features/titles/server/settle-batch";
import { jsonError } from "@/lib/api";
import { yesterdayKstDate } from "@/lib/kst";

/** 배치가 길어질 수 있어 정적 최적화를 막고 매번 실행되게 한다 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 자정 자동 정산 (ADR 0008). Vercel Cron 이 매일 KST 00:05 에 부른다.
 *
 * 공개 URL 이므로 CRON_SECRET 없이는 아무것도 하지 않는다. Vercel Cron 은
 * `Authorization: Bearer $CRON_SECRET` 을 자동으로 실어 보낸다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(500, "CRON_SECRET 이 설정되지 않았어요");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "권한이 없어요");
  }

  const report = await settleAllForDate(yesterdayKstDate());
  return Response.json(report);
}
