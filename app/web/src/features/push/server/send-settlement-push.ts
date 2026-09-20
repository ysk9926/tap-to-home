import "server-only";
import { settlementMessage } from "@/features/titles/messages";
import type { TitleId } from "@/features/titles/catalog";
import { prisma } from "@/lib/db";
import { isPushConfigured, sendToToken } from "./fcm";
import { dropPushTokens, listPushTokens } from "./tokens";

export type SettlementPushItem = {
  userId: string;
  primaryTitleId: TitleId | null;
  total: number;
};

/**
 * 자정 정산 알림 (ADR 0008). 정산된 유저마다 한 건.
 *
 * `notifySettlement` 를 끈 유저는 건너뛴다. 알림을 못 받아도 결과는 앱 진입 다이얼로그가
 * 전달하므로(Task 7) 여기서 실패해도 사용자가 결과를 놓치지는 않는다. 그래서 실패는
 * 로그만 남긴다.
 *
 * 알림을 탭하면 그 날짜의 기록 상세로 연다.
 */
export async function sendSettlementPush(items: SettlementPushItem[], ymd: string): Promise<void> {
  if (items.length === 0 || !isPushConfigured()) return;

  const optedIn = await prisma.user.findMany({
    where: { id: { in: items.map((i) => i.userId) }, notifySettlement: true, deletedAt: null },
    select: { id: true },
  });
  const allowed = new Set(optedIn.map((u) => u.id));
  const targets = items.filter((i) => allowed.has(i.userId));
  if (targets.length === 0) return;

  const tokensByUser = await listPushTokens(targets.map((i) => i.userId));
  if (tokensByUser.size === 0) return;

  const dead: string[] = [];
  for (const item of targets) {
    const tokens = tokensByUser.get(item.userId);
    if (!tokens) continue;
    const { title, body } = settlementMessage(item.primaryTitleId, item.total);
    await Promise.all(
      tokens.map(async (token) => {
        const outcome = await sendToToken(token, { title, body, path: `/records/${ymd}` });
        if (outcome === "unregistered") dead.push(token);
      }),
    );
  }

  await dropPushTokens(dead);
}
