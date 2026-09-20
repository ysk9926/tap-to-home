import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { SIGNAL_COOLDOWN_MS, markSignalsRead, sendSignal, takeUnreadSignals } from "./signals";

const NOW = new Date("2026-09-19T04:00:00Z");
let s: { id: string; name: string };
let r1: { id: string };
let r2: { id: string };

beforeAll(async () => {
  [s, r1, r2] = await Promise.all([createTestUser("sender"), createTestUser("r1"), createTestUser("r2")]);
  await prisma.friendship.createMany({
    data: [
      { requesterId: s.id, addresseeId: r1.id, status: "accepted" },
      { requesterId: r2.id, addresseeId: s.id, status: "accepted" },
    ],
  });
});
afterAll(async () => {
  await deleteTestUsers([s.id, r1.id, r2.id]);
});

describe("sendSignal", () => {
  it("delivers to all friends once, then rate-limits the same level for 10 minutes", async () => {
    const first = await sendSignal(s.id, "urgent", NOW);
    expect(first.delivered.sort()).toEqual([r1.id, r2.id].sort());

    const again = await sendSignal(s.id, "urgent", new Date(NOW.getTime() + 60_000));
    expect(again.delivered).toEqual([]);

    const other = await sendSignal(s.id, "strong", new Date(NOW.getTime() + 60_000));
    expect(other.delivered).toHaveLength(2);

    const later = await sendSignal(s.id, "urgent", new Date(NOW.getTime() + SIGNAL_COOLDOWN_MS + 1));
    expect(later.delivered).toHaveLength(2);
  });
});

describe("takeUnreadSignals", () => {
  it("returns recent unread signals with sender name and marks them read", async () => {
    const at = new Date(NOW.getTime() + SIGNAL_COOLDOWN_MS + 1000);
    const unread = await takeUnreadSignals(r1.id, at);
    expect(unread.length).toBeGreaterThan(0);
    expect(unread[0]).toMatchObject({ senderName: s.name, level: expect.any(String) });
    expect(await takeUnreadSignals(r1.id, at)).toEqual([]);
  });
});

describe("markSignalsRead", () => {
  it("only marks the authenticated receiver's rows and is idempotent", async () => {
    const at = new Date(NOW.getTime() + 5 * SIGNAL_COOLDOWN_MS);
    const sent = await sendSignal(s.id, "normal", at);

    await markSignalsRead(r1.id, sent.signals.map((signal) => signal.id), at);
    await markSignalsRead(r1.id, sent.signals.map((signal) => signal.id), at);

    const rows = await prisma.signal.findMany({
      where: { id: { in: sent.signals.map((signal) => signal.id) } },
    });
    expect(rows.find((row) => row.receiverId === r1.id)?.readAt).toEqual(at);
    expect(rows.find((row) => row.receiverId === r2.id)?.readAt).toBeNull();
  });
});
