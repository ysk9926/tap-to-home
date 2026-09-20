import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";
import { kstDate } from "@/lib/kst";

export const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

async function recordActivityWithDb(
  db: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<boolean> {
  const active = await db.user.findFirst({
    where: { id: userId, ...ACTIVE_USER },
    select: { id: true },
  });
  if (!active) return false;

  await db.analyticsConfig.createMany({
    data: [{ id: "product", startedAt: now }],
    skipDuplicates: true,
  });

  const activityDate = kstDate(now);
  await db.userDailyActivity.createMany({
    data: [{ userId, activityDate, firstSeenAt: now, lastSeenAt: now }],
    skipDuplicates: true,
  });
  await db.userDailyActivity.updateMany({
    where: {
      userId,
      activityDate,
      lastSeenAt: { lte: new Date(now.getTime() - ACTIVITY_UPDATE_INTERVAL_MS) },
    },
    data: { lastSeenAt: now },
  });
  return true;
}

/**
 * 서버가 확인한 활성 회원의 KST 일별 방문을 기록한다. 호출자가 트랜잭션을 넘기면 도메인
 * 변경과 같은 커밋에 포함하고, 없으면 활성 상태 확인부터 기록까지 한 트랜잭션으로 묶는다.
 */
export async function recordActivity(
  userId: string,
  now: Date = new Date(),
  db?: Prisma.TransactionClient,
): Promise<boolean> {
  if (db) return recordActivityWithDb(db, userId, now);
  return prisma.$transaction((tx) => recordActivityWithDb(tx, userId, now));
}
