import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate, todayKst } from "@/lib/kst";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { sortRacers, type RaceToday, type Racer } from "../race-state";

/** 오늘(KST) 나+친구의 레이스 상태. 페이지 초기 데이터와 GET /api/race/today 가 같이 쓴다 */
export async function getRaceToday(user: CurrentUser, now: Date = new Date()): Promise<RaceToday> {
  const runDate = kstDate(now);
  const friendIds = await listFriendIds(user.id);

  const users = await prisma.user.findMany({
    where: { id: { in: [user.id, ...friendIds] } },
    select: {
      id: true,
      name: true,
      username: true,
      dailyRuns: {
        where: { runDate },
        select: { tapCount: true, stage: true, result: { select: { dailyRunId: true } } },
      },
    },
  });

  const racers: Racer[] = users.map((u) => ({
    userId: u.id,
    name: u.name,
    username: u.username ?? "",
    tapCount: u.dailyRuns[0]?.tapCount ?? 0,
    stage: u.dailyRuns[0]?.stage ?? 0,
    isMe: u.id === user.id,
  }));

  const sorted = sortRacers(racers);
  const me = sorted.find((r) => r.isMe) ?? {
    userId: user.id,
    name: user.name,
    username: user.username,
    tapCount: 0,
    stage: 0,
    isMe: true,
  };
  const settled = Boolean(users.find((u) => u.id === user.id)?.dailyRuns[0]?.result);

  return { date: todayKst(now), me, racers: sorted, settled };
}
