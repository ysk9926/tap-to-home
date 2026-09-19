import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { listFriendIds } from "./list-friend-ids";

export type FriendSummary = { userId: string; username: string; name: string; tapCount: number };
export type FoundUser = { id: string; username: string; name: string };

export class FriendError extends Error {
  constructor(
    public code: "self" | "not_found" | "already",
    message: string,
  ) {
    super(message);
  }
}

/** better-auth username 플러그인과 같은 정규화 (소문자) */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function listFriends(userId: string, now: Date = new Date()): Promise<FriendSummary[]> {
  const ids = await listFriendIds(userId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      username: true,
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

export async function searchUser(rawUsername: string, selfId: string): Promise<FoundUser | null> {
  const username = normalizeUsername(rawUsername);
  if (!username) return null;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true },
  });
  if (!user || user.id === selfId) return null;
  return { id: user.id, username: user.username ?? "", name: user.name };
}

/** 아이디로 즉시 친구 등록 (F0-2). 수락 절차 없이 accepted */
export async function addFriend(
  userId: string,
  rawUsername: string,
  now: Date = new Date(),
): Promise<FriendSummary> {
  const username = normalizeUsername(rawUsername);
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true },
  });
  if (!target) throw new FriendError("not_found", "그 아이디는 없어요");
  if (target.id === userId) throw new FriendError("self", "나 자신은 등록할 수 없어요");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
    select: { id: true },
  });
  if (existing) throw new FriendError("already", "이미 친구예요");

  try {
    await prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id, status: "accepted" },
    });
  } catch (e) {
    // 동시 중복 등록: unique(requesterId, addresseeId) 위반은 "이미 친구" 로 처리한다
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
      throw new FriendError("already", "이미 친구예요");
    }
    throw e;
  }

  const run = await prisma.dailyRun.findUnique({
    where: { userId_runDate: { userId: target.id, runDate: kstDate(now) } },
    select: { tapCount: true },
  });
  return { userId: target.id, username: target.username ?? "", name: target.name, tapCount: run?.tapCount ?? 0 };
}
