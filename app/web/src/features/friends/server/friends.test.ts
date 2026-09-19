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

  it("refuses the requester and anyone else — only the addressee may accept", async () => {
    const id = await sendRequest(a.id, b.username);
    await expect(acceptRequest(a.id, id, NOW)).rejects.toMatchObject({ code: "no_request" });
    expect(await listFriends(a.id, NOW)).toEqual([]);
  });
});

describe("declineRequest and cancelRequest", () => {
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
    await removeFriend(b.id, a.id);
    expect(await listFriends(a.id, NOW)).toEqual([]);
    expect(await listFriends(b.id, NOW)).toEqual([]);
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
