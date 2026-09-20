import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export const PRODUCT_EVENT_TYPES = [
  "friend_requested",
  "friend_accepted",
  "friend_declined",
  "friend_cancelled",
  "friend_removed",
  "friend_blocked",
  "friend_unblocked",
  "result_viewed",
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

export type ProductEventInput = {
  userId: string;
  otherUserId?: string;
  type: ProductEventType;
  entityId: string;
  occurredAt?: Date;
  dedupeKey?: string;
};

/** 도메인 변경과 같은 트랜잭션에서만 호출한다. */
export async function recordProductEvent(
  db: Prisma.TransactionClient,
  input: ProductEventInput,
): Promise<void> {
  const occurredAt = input.occurredAt ?? new Date();
  await db.analyticsConfig.createMany({
    data: [{ id: "product", startedAt: occurredAt }],
    skipDuplicates: true,
  });
  await db.productEvent.create({
    data: {
      userId: input.userId,
      otherUserId: input.otherUserId,
      type: input.type,
      entityId: input.entityId,
      occurredAt,
      dedupeKey: input.dedupeKey,
    },
  });
}

/** 결과 상세는 사용자·dailyRun 당 최초 한 번만 실제 열람으로 센다. */
export async function recordResultViewed(
  db: Prisma.TransactionClient,
  userId: string,
  dailyRunId: string,
  occurredAt: Date = new Date(),
): Promise<void> {
  await db.analyticsConfig.createMany({
    data: [{ id: "product", startedAt: occurredAt }],
    skipDuplicates: true,
  });
  await db.productEvent.createMany({
    data: [{
      dedupeKey: `result_viewed:${userId}:${dailyRunId}`,
      userId,
      type: "result_viewed",
      entityId: dailyRunId,
      occurredAt,
    }],
    skipDuplicates: true,
  });
}
