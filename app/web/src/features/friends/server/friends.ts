import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordProductEvent } from "@/features/analytics/server/events";
import { prisma } from "@/lib/db";
import { ACTIVE_USER } from "@/lib/db/active-user";
import { kstDate } from "@/lib/kst";
import { listFriendIds } from "./list-friend-ids";

export type FriendSummary = { userId: string; username: string; name: string; tapCount: number };
export type FoundUser = { id: string; username: string; name: string };
/** 대기 중인 요청 한 건. `user` 는 상대방 (받은 요청이면 보낸 사람, 보낸 요청이면 받는 사람) */
export type FriendRequest = { id: string; user: FoundUser; createdAt: string };
export type BlockedUser = { id: string; user: FoundUser };

export class FriendError extends Error {
  constructor(
    public code: "self" | "not_found" | "already" | "requested" | "blocked" | "no_request",
    message: string,
  ) {
    super(message);
  }
}

/** better-auth username 플러그인과 같은 정규화 (소문자) */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

const USER_FIELDS = { id: true, username: true, name: true } as const;
type UserRow = { id: string; username: string | null; name: string };

function toFoundUser(u: UserRow): FoundUser {
  return { id: u.id, username: u.username ?? "", name: u.name };
}

/** 두 사람 사이의 관계 row. 방향과 무관하게 하나만 존재한다 (양방향 unique 는 애플리케이션이 지킨다) */
function betweenWhere(a: string, b: string) {
  return {
    OR: [
      { requesterId: a, addresseeId: b },
      { requesterId: b, addresseeId: a },
    ],
  };
}

async function requireActiveUser(db: Prisma.TransactionClient, userId: string): Promise<void> {
  const user = await db.user.findFirst({ where: { id: userId, ...ACTIVE_USER }, select: { id: true } });
  if (!user) throw new FriendError("not_found", "그 사용자는 없어요");
}

export async function listFriends(userId: string, now: Date = new Date()): Promise<FriendSummary[]> {
  const ids = await listFriendIds(userId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, ...ACTIVE_USER },
    select: {
      ...USER_FIELDS,
      dailyRuns: { where: { runDate: kstDate(now) }, select: { tapCount: true } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    userId: u.id,
    username: u.username ?? "",
    name: u.name,
    tapCount: u.dailyRuns[0]?.tapCount ?? 0,
  }));
}

/** 내가 받은 대기 중인 요청 (수락·거절 대상) */
export async function listIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "pending", addressee: ACTIVE_USER, requester: ACTIVE_USER },
    select: { id: true, createdAt: true, requester: { select: USER_FIELDS } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, user: toFoundUser(r.requester), createdAt: r.createdAt.toISOString() }));
}

/** 내가 보낸 대기 중인 요청 (취소 대상) */
export async function listOutgoingRequests(userId: string): Promise<FriendRequest[]> {
  const rows = await prisma.friendship.findMany({
    where: { requesterId: userId, status: "pending", requester: ACTIVE_USER, addressee: ACTIVE_USER },
    select: { id: true, createdAt: true, addressee: { select: USER_FIELDS } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ id: r.id, user: toFoundUser(r.addressee), createdAt: r.createdAt.toISOString() }));
}

/** 내가 차단한 사람만. 나를 차단한 사람은 보여주지 않는다 (해제 권한이 없으므로) */
export async function listBlocked(userId: string): Promise<BlockedUser[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "blocked", blockedById: userId, blockedBy: ACTIVE_USER, requester: ACTIVE_USER, addressee: ACTIVE_USER },
    select: { id: true, requester: { select: USER_FIELDS }, addressee: { select: USER_FIELDS } },
    orderBy: { respondedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    user: toFoundUser(r.requester.id === userId ? r.addressee : r.requester),
  }));
}

export async function searchUser(rawUsername: string, selfId: string): Promise<FoundUser | null> {
  const username = normalizeUsername(rawUsername);
  if (!username) return null;
  const user = await prisma.user.findFirst({ where: { username, ...ACTIVE_USER }, select: USER_FIELDS });
  if (!user || user.id === selfId) return null;
  const blocked = await prisma.friendship.findFirst({
    where: { status: "blocked", ...betweenWhere(selfId, user.id) },
    select: { id: true },
  });
  if (blocked) return null;
  return toFoundUser(user);
}

export type RequestResult =
  | { kind: "requested"; request: FriendRequest }
  /** 상대가 이미 나에게 보낸 요청이 있어 곧바로 친구가 된 경우 */
  | { kind: "accepted"; friend: FriendSummary };

/**
 * 아이디로 친구 요청을 보낸다 (F0-2). 상대가 수락해야 친구가 된다.
 * 상대가 이미 나에게 요청을 보내 둔 상태면 새 요청 대신 그 요청을 수락한다.
 */
export async function requestFriend(
  userId: string,
  rawUsername: string,
  now: Date = new Date(),
): Promise<RequestResult> {
  const username = normalizeUsername(rawUsername);
  try {
    return await prisma.$transaction(async (tx) => {
      await requireActiveUser(tx, userId);
      const target = await tx.user.findFirst({ where: { username, ...ACTIVE_USER }, select: USER_FIELDS });
      if (!target) throw new FriendError("not_found", "그 아이디는 없어요");
      if (target.id === userId) throw new FriendError("self", "나 자신은 등록할 수 없어요");

      const existing = await tx.friendship.findFirst({
        where: betweenWhere(userId, target.id),
        select: { id: true, status: true, requesterId: true },
      });
      if (existing?.status === "accepted") throw new FriendError("already", "이미 친구예요");
      if (existing?.status === "blocked") throw new FriendError("blocked", "요청을 보낼 수 없는 상대예요");
      if (existing?.status === "pending") {
        if (existing.requesterId === userId) throw new FriendError("requested", "이미 요청을 보냈어요");
        return { kind: "accepted", friend: await acceptRequestWithDb(tx, userId, existing.id, now) };
      }

      const created = await tx.friendship.create({
        data: { requesterId: userId, addresseeId: target.id, status: "pending" },
        select: { id: true, createdAt: true },
      });
      await recordProductEvent(tx, {
        userId,
        otherUserId: target.id,
        type: "friend_requested",
        entityId: created.id,
        occurredAt: now,
      });
      return {
        kind: "requested" as const,
        request: { id: created.id, user: toFoundUser(target), createdAt: created.createdAt.toISOString() },
      };
    });
  } catch (e) {
    // 동시 중복 요청: unique(requesterId, addresseeId) 위반
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
      throw new FriendError("requested", "이미 요청을 보냈어요");
    }
    throw e;
  }
}

/** 받은 요청 수락 (F0-3). 받은 쪽만 수락할 수 있다 */
export async function acceptRequest(
  userId: string,
  requestId: string,
  now: Date = new Date(),
): Promise<FriendSummary> {
  return prisma.$transaction((tx) => acceptRequestWithDb(tx, userId, requestId, now));
}

async function acceptRequestWithDb(
  db: Prisma.TransactionClient,
  userId: string,
  requestId: string,
  now: Date,
): Promise<FriendSummary> {
  await requireActiveUser(db, userId);
  const row = await db.friendship.findFirst({
    where: { id: requestId, addresseeId: userId, status: "pending", requester: ACTIVE_USER },
    select: { id: true, requester: { select: USER_FIELDS } },
  });
  if (!row) throw new FriendError("no_request", "처리할 요청이 없어요");

  const updated = await db.friendship.updateMany({
    where: { id: row.id, addresseeId: userId, status: "pending" },
    data: { status: "accepted", respondedAt: now },
  });
  if (updated.count === 0) throw new FriendError("no_request", "처리할 요청이 없어요");
  await recordProductEvent(db, {
    userId,
    otherUserId: row.requester.id,
    type: "friend_accepted",
    entityId: row.id,
    occurredAt: now,
  });

  const run = await db.dailyRun.findUnique({
    where: { userId_runDate: { userId: row.requester.id, runDate: kstDate(now) } },
    select: { tapCount: true },
  });
  return {
    userId: row.requester.id,
    username: row.requester.username ?? "",
    name: row.requester.name,
    tapCount: run?.tapCount ?? 0,
  };
}

/**
 * 받은 요청 거절 (F0-3). row 를 지워 상대가 다시 요청할 수 있게 둔다.
 * 상대에게 거절 사실을 알리지 않는다.
 */
export async function declineRequest(userId: string, requestId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireActiveUser(tx, userId);
    const row = await tx.friendship.findFirst({
      where: { id: requestId, addresseeId: userId, status: "pending", requester: ACTIVE_USER },
      select: { id: true, requesterId: true },
    });
    if (!row) throw new FriendError("no_request", "처리할 요청이 없어요");
    const removed = await tx.friendship.deleteMany({ where: { id: row.id, addresseeId: userId, status: "pending" } });
    if (removed.count === 0) throw new FriendError("no_request", "처리할 요청이 없어요");
    await recordProductEvent(tx, {
      userId,
      otherUserId: row.requesterId,
      type: "friend_declined",
      entityId: row.id,
      occurredAt: now,
    });
  });
}

/** 내가 보낸 요청 취소 (F0-2) */
export async function cancelRequest(userId: string, requestId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireActiveUser(tx, userId);
    const row = await tx.friendship.findFirst({
      where: { id: requestId, requesterId: userId, status: "pending", addressee: ACTIVE_USER },
      select: { id: true, addresseeId: true },
    });
    if (!row) throw new FriendError("no_request", "취소할 요청이 없어요");
    const removed = await tx.friendship.deleteMany({ where: { id: row.id, requesterId: userId, status: "pending" } });
    if (removed.count === 0) throw new FriendError("no_request", "취소할 요청이 없어요");
    await recordProductEvent(tx, {
      userId,
      otherUserId: row.addresseeId,
      type: "friend_cancelled",
      entityId: row.id,
      occurredAt: now,
    });
  });
}

/** 친구 삭제 (F0-4). 양쪽에서 사라지고 다시 요청할 수 있다 */
export async function removeFriend(userId: string, friendId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await Promise.all([requireActiveUser(tx, userId), requireActiveUser(tx, friendId)]);
    const row = await tx.friendship.findFirst({
      where: { status: "accepted", ...betweenWhere(userId, friendId) },
      select: { id: true },
    });
    if (!row) throw new FriendError("not_found", "친구가 아니에요");
    const removed = await tx.friendship.deleteMany({
      where: { status: "accepted", ...betweenWhere(userId, friendId) },
    });
    if (removed.count === 0) throw new FriendError("not_found", "친구가 아니에요");
    await recordProductEvent(tx, {
      userId,
      otherUserId: friendId,
      type: "friend_removed",
      entityId: row.id,
      occurredAt: now,
    });
  });
}

/**
 * 차단 (F0-4). 친구든 아니든, 요청 중이든 상관없이 blocked row 하나로 수렴시킨다.
 * blockedById 로 누가 차단했는지 남겨 해제 권한을 판별한다.
 */
export async function blockUser(userId: string, targetId: string, now: Date = new Date()): Promise<void> {
  if (userId === targetId) throw new FriendError("self", "나 자신은 차단할 수 없어요");
  await prisma.$transaction(async (tx) => {
    await Promise.all([requireActiveUser(tx, userId), requireActiveUser(tx, targetId)]);
    const existing = await tx.friendship.findFirst({
      where: betweenWhere(userId, targetId),
      select: { id: true },
    });
    const friendshipId = existing
      ? (await tx.friendship.update({
          where: { id: existing.id },
          data: { status: "blocked", blockedById: userId, respondedAt: now },
          select: { id: true },
        })).id
      : (await tx.friendship.create({
          data: {
            requesterId: userId,
            addresseeId: targetId,
            status: "blocked",
            blockedById: userId,
            respondedAt: now,
          },
          select: { id: true },
        })).id;
    await tx.friendship.deleteMany({
      where: { id: { not: friendshipId }, ...betweenWhere(userId, targetId) },
    });
    await recordProductEvent(tx, {
      userId,
      otherUserId: targetId,
      type: "friend_blocked",
      entityId: friendshipId,
      occurredAt: now,
    });
  });
}

/** 차단 해제 (F0-4). 차단한 사람만 풀 수 있고, 풀면 친구가 아닌 상태로 돌아간다 */
export async function unblockUser(userId: string, friendshipId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireActiveUser(tx, userId);
    const row = await tx.friendship.findFirst({
      where: { id: friendshipId, status: "blocked", blockedById: userId },
      select: { id: true, requesterId: true, addresseeId: true },
    });
    if (!row) throw new FriendError("not_found", "차단한 상대가 아니에요");
    const otherUserId = row.requesterId === userId ? row.addresseeId : row.requesterId;
    const removed = await tx.friendship.deleteMany({ where: { id: row.id, status: "blocked", blockedById: userId } });
    if (removed.count === 0) throw new FriendError("not_found", "차단한 상대가 아니에요");
    await recordProductEvent(tx, {
      userId,
      otherUserId,
      type: "friend_unblocked",
      entityId: row.id,
      occurredAt: now,
    });
  });
}
