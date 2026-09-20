import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { prisma } from "@/lib/db";
import { recordTaps } from "@/features/race/server/record-taps";
import {
  FriendError,
  acceptRequest,
  blockUser,
  cancelRequest,
  declineRequest,
  listBlocked,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  requestFriend,
  searchUser,
  unblockUser,
} from "./friends";

const NOW = new Date("2026-09-19T03:00:00Z");
let a: { id: string; username: string };
let b: { id: string; username: string };

/** 요청을 보내고 요청 id 를 돌려준다. kind 가 requested 가 아니면 테스트 전제가 깨진 것 */
async function sendRequest(from: string, toUsername: string): Promise<string> {
  const result = await requestFriend(from, toUsername, NOW);
  if (result.kind !== "requested") throw new Error(`expected requested, got ${result.kind}`);
  return result.request.id;
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("fa"), createTestUser("fb")]);
  await recordTaps(b.id, 7, NOW);
});
afterAll(async () => {
  await deleteTestUsers([a.id, b.id]);
});
// 각 테스트는 관계가 없는 상태에서 시작한다
afterEach(async () => {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: a.id, addresseeId: b.id },
        { requesterId: b.id, addresseeId: a.id },
      ],
    },
  });
});

describe("searchUser", () => {
  it("is case-insensitive and hides myself", async () => {
    expect(await searchUser(b.username.toUpperCase(), a.id)).toMatchObject({ id: b.id, username: b.username });
    expect(await searchUser(a.username, a.id)).toBeNull();
    expect(await searchUser("nobody_here_xyz", a.id)).toBeNull();
  });

  it("hides users on either side of a block", async () => {
    await blockUser(a.id, b.id, NOW);
    expect(await searchUser(b.username, a.id)).toBeNull();
    expect(await searchUser(a.username, b.id)).toBeNull();
  });
});

describe("requestFriend", () => {
  it("creates a pending request that is not yet a friendship", async () => {
    const result = await requestFriend(a.id, ` ${b.username.toUpperCase()} `, NOW);
    expect(result).toMatchObject({ kind: "requested", request: { user: { id: b.id } } });
    expect(await listFriends(a.id, NOW)).toEqual([]);
    expect(await listFriends(b.id, NOW)).toEqual([]);
    expect((await listOutgoingRequests(a.id)).map((r) => r.user.id)).toEqual([b.id]);
    expect((await listIncomingRequests(b.id)).map((r) => r.user.id)).toEqual([a.id]);
  });

  it("rejects self, unknown ids, and a duplicate request from the same side", async () => {
    await expect(requestFriend(a.id, a.username, NOW)).rejects.toMatchObject({ code: "self" });
    await expect(requestFriend(a.id, "nobody_here_xyz", NOW)).rejects.toBeInstanceOf(FriendError);
    await sendRequest(a.id, b.username);
    await expect(requestFriend(a.id, b.username, NOW)).rejects.toMatchObject({ code: "requested" });
  });

  it("accepts the existing request when both sides request each other", async () => {
    await sendRequest(a.id, b.username);
    const result = await requestFriend(b.id, a.username, NOW);
    expect(result).toMatchObject({ kind: "accepted", friend: { userId: a.id } });
    expect((await listFriends(a.id, NOW)).map((f) => f.userId)).toEqual([b.id]);
  });

  it("rejects an already-accepted pair and a blocked pair", async () => {
    const id = await sendRequest(a.id, b.username);
    await acceptRequest(b.id, id, NOW);
    await expect(requestFriend(a.id, b.username, NOW)).rejects.toMatchObject({ code: "already" });
    await expect(requestFriend(b.id, a.username, NOW)).rejects.toMatchObject({ code: "already" });

    await blockUser(a.id, b.id, NOW);
    await expect(requestFriend(b.id, a.username, NOW)).rejects.toMatchObject({ code: "blocked" });
  });
});

describe("acceptRequest", () => {
  it("makes both sides friends and reports today's taps", async () => {
    const id = await sendRequest(a.id, b.username);
    const friend = await acceptRequest(b.id, id, NOW);
    expect(friend).toMatchObject({ userId: a.id, tapCount: 0 });
    expect((await listFriends(a.id, NOW)).map((f) => f.userId)).toEqual([b.id]);
    expect((await listFriends(b.id, NOW)).map((f) => f.userId)).toEqual([a.id]);
    expect(await listIncomingRequests(b.id)).toEqual([]);
    expect(await listOutgoingRequests(a.id)).toEqual([]);
  });

  it("emits one acceptance when two handlers race for the same request", async () => {
    const id = await sendRequest(a.id, b.username);
    const outcomes = await Promise.allSettled([
      acceptRequest(b.id, id, NOW),
      acceptRequest(b.id, id, NOW),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.productEvent.count({ where: { entityId: id, type: "friend_accepted" } })).toBe(1);
  });

  it("refuses the requester and anyone else — only the addressee may accept", async () => {
    const id = await sendRequest(a.id, b.username);
    await expect(acceptRequest(a.id, id, NOW)).rejects.toMatchObject({ code: "no_request" });
    expect(await listFriends(a.id, NOW)).toEqual([]);
  });
});

describe("declineRequest and cancelRequest", () => {
  it.each(["decline", "cancel"])("allows only one transition when acceptance races with %s", async (action) => {
    const id = await sendRequest(a.id, b.username);
    // Hold the row so both handlers read pending, then queue acceptance first.
    let release!: () => void;
    let locked!: (pid: number) => void;
    const releaseLock = new Promise<void>((resolve) => { release = resolve; });
    const lockReady = new Promise<number>((resolve) => { locked = resolve; });
    const lock = prisma.$transaction(async (tx) => {
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT id FROM friendship WHERE id = ${id} FOR UPDATE`;
      locked(connection.pid);
      await releaseLock;
    }, { timeout: 10_000 });
    const pid = await lockReady;
    const blocked = async () => {
      const [row] = await prisma.$queryRaw<{ count: number }[]>`
        WITH RECURSIVE waiting AS (
          SELECT pid FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid = ANY(pg_blocking_pids(a.pid))
        ) SELECT COUNT(*)::int AS count FROM waiting`;
      return row.count;
    };
    const accepted = Promise.allSettled([acceptRequest(b.id, id, NOW)]);
    let removed: Promise<PromiseSettledResult<void>[]> | undefined;
    try {
      await expect.poll(blocked).toBe(1);
      removed = Promise.allSettled([action === "decline" ? declineRequest(b.id, id, NOW) : cancelRequest(a.id, id, NOW)]);
      await expect.poll(blocked).toBe(2);
    } finally {
      release();
      await lock;
    }
    const outcomes = [...await accepted, ...await removed!];
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const events = await prisma.productEvent.findMany({ where: { entityId: id, type: { not: "friend_requested" } } });
    expect(events).toHaveLength(1);
    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (events[0].type === "friend_accepted") expect(friendship?.status).toBe("accepted");
    else expect(friendship).toBeNull();
  });

  it("decline removes the request and lets the requester try again", async () => {
    const id = await sendRequest(a.id, b.username);
    await declineRequest(b.id, id);
    expect(await listIncomingRequests(b.id)).toEqual([]);
    expect((await requestFriend(a.id, b.username, NOW)).kind).toBe("requested");
  });

  it("decline refuses the requester, cancel refuses the addressee", async () => {
    const id = await sendRequest(a.id, b.username);
    await expect(declineRequest(a.id, id)).rejects.toMatchObject({ code: "no_request" });
    await expect(cancelRequest(b.id, id)).rejects.toMatchObject({ code: "no_request" });
    await cancelRequest(a.id, id);
    expect(await listOutgoingRequests(a.id)).toEqual([]);
  });
});

describe("removeFriend", () => {
  it("removes the friendship from both sides and allows a new request", async () => {
    const id = await sendRequest(a.id, b.username);
    await acceptRequest(b.id, id, NOW);
    await prisma.friendship.create({
      data: { requesterId: b.id, addresseeId: a.id, status: "accepted", respondedAt: NOW },
    });
    await removeFriend(b.id, a.id);
    expect(await listFriends(a.id, NOW)).toEqual([]);
    expect(await listFriends(b.id, NOW)).toEqual([]);
    expect(await prisma.friendship.count({
      where: {
        OR: [
          { requesterId: a.id, addresseeId: b.id },
          { requesterId: b.id, addresseeId: a.id },
        ],
      },
    })).toBe(0);
    expect((await requestFriend(a.id, b.username, NOW)).kind).toBe("requested");
  });

  it("refuses when there is no accepted friendship", async () => {
    await sendRequest(a.id, b.username);
    await expect(removeFriend(a.id, b.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("blockUser and unblockUser", () => {
  it("blocking a friend drops them from both race lists", async () => {
    const id = await sendRequest(a.id, b.username);
    await acceptRequest(b.id, id, NOW);
    await blockUser(a.id, b.id, NOW);
    expect(await listFriends(a.id, NOW)).toEqual([]);
    expect(await listFriends(b.id, NOW)).toEqual([]);
  });

  it("only the blocker sees the block and can lift it", async () => {
    await blockUser(a.id, b.id, NOW);
    expect((await listBlocked(a.id)).map((r) => r.user.id)).toEqual([b.id]);
    expect(await listBlocked(b.id)).toEqual([]);

    const [blocked] = await listBlocked(a.id);
    await expect(unblockUser(b.id, blocked.id)).rejects.toMatchObject({ code: "not_found" });
    await unblockUser(a.id, blocked.id);
    expect(await listBlocked(a.id)).toEqual([]);
    expect(await searchUser(b.username, a.id)).toMatchObject({ id: b.id });
  });

  it("blocking replaces a pending request rather than adding a second row", async () => {
    await sendRequest(a.id, b.username);
    await blockUser(b.id, a.id, NOW);
    expect(await listIncomingRequests(b.id)).toEqual([]);
    expect(await listOutgoingRequests(a.id)).toEqual([]);
    expect(await prisma.friendship.count({ where: { requesterId: a.id, addresseeId: b.id } })).toBe(1);
  });

  it("refuses blocking myself", async () => {
    await expect(blockUser(a.id, a.id, NOW)).rejects.toMatchObject({ code: "self" });
  });
});

describe("product events", () => {
  it("keeps the successful friendship history after the relationship row is deleted", async () => {
    const requestId = await sendRequest(a.id, b.username);
    await acceptRequest(b.id, requestId, new Date(NOW.getTime() + 1));
    await removeFriend(a.id, b.id, new Date(NOW.getTime() + 2));

    expect(await prisma.friendship.findFirst({ where: { id: requestId } })).toBeNull();
    const events = await prisma.productEvent.findMany({
      where: { entityId: requestId },
      orderBy: { occurredAt: "asc" },
      select: { type: true, userId: true, otherUserId: true },
    });
    expect(events).toEqual([
      { type: "friend_requested", userId: a.id, otherUserId: b.id },
      { type: "friend_accepted", userId: b.id, otherUserId: a.id },
      { type: "friend_removed", userId: a.id, otherUserId: b.id },
    ]);
  });

  it("records decline, cancel, block, and unblock with the other member", async () => {
    let requestId = await sendRequest(a.id, b.username);
    const declineId = requestId;
    await declineRequest(b.id, requestId, new Date(NOW.getTime() + 1));
    requestId = await sendRequest(a.id, b.username);
    const cancelId = requestId;
    await cancelRequest(a.id, requestId, new Date(NOW.getTime() + 2));
    await blockUser(a.id, b.id, new Date(NOW.getTime() + 3));
    const blocked = await prisma.friendship.findFirstOrThrow({ where: { blockedById: a.id } });
    await unblockUser(a.id, blocked.id, new Date(NOW.getTime() + 4));

    const events = await prisma.productEvent.findMany({
      where: {
        entityId: { in: [declineId, cancelId, blocked.id] },
        type: { in: ["friend_declined", "friend_cancelled", "friend_blocked", "friend_unblocked"] },
      },
      orderBy: { occurredAt: "asc" },
      select: { type: true, userId: true, otherUserId: true },
    });
    expect(events).toEqual([
      { type: "friend_declined", userId: b.id, otherUserId: a.id },
      { type: "friend_cancelled", userId: a.id, otherUserId: b.id },
      { type: "friend_blocked", userId: a.id, otherUserId: b.id },
      { type: "friend_unblocked", userId: a.id, otherUserId: b.id },
    ]);
  });
});

describe("suspended members", () => {
  it("cannot be targeted by requests or blocks", async () => {
    await prisma.user.update({ where: { id: b.id }, data: { suspendedAt: NOW } });
    try {
      await expect(requestFriend(a.id, b.username, NOW)).rejects.toMatchObject({ code: "not_found" });
      await expect(blockUser(a.id, b.id, NOW)).rejects.toMatchObject({ code: "not_found" });
    } finally {
      await prisma.user.update({ where: { id: b.id }, data: { suspendedAt: null } });
    }
  });

  it("cannot accept a request from a member suspended after requesting", async () => {
    const requestId = await sendRequest(a.id, b.username);
    await prisma.user.update({ where: { id: a.id }, data: { suspendedAt: NOW } });
    try {
      await expect(acceptRequest(b.id, requestId, NOW)).rejects.toMatchObject({ code: "no_request" });
    } finally {
      await prisma.user.update({ where: { id: a.id }, data: { suspendedAt: null } });
    }
  });
});
