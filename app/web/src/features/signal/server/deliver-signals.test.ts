import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";

const mocks = vi.hoisted(() => ({
  broadcast: vi.fn(),
  sendSignalPush: vi.fn(),
}));

vi.mock("@/features/realtime/server/broadcast", () => ({ broadcast: mocks.broadcast }));
vi.mock("@/features/push/server/send-signal-push", () => ({ sendSignalPush: mocks.sendSignalPush }));

import { sendSignal } from "./signals";
import { deliverSignals } from "./deliver-signals";

const NOW = new Date("2026-09-20T04:00:00.000Z");
let sender: { id: string; name: string };
let receiver1: { id: string };
let receiver2: { id: string };

beforeAll(async () => {
  [sender, receiver1, receiver2] = await Promise.all([
    createTestUser("delivery-sender"),
    createTestUser("delivery-r1"),
    createTestUser("delivery-r2"),
  ]);
  await prisma.friendship.createMany({
    data: [
      { requesterId: sender.id, addresseeId: receiver1.id, status: "accepted" },
      { requesterId: receiver2.id, addresseeId: sender.id, status: "accepted" },
    ],
  });
});

afterAll(async () => deleteTestUsers([sender.id, receiver1.id, receiver2.id]));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.broadcast.mockResolvedValue(true);
  mocks.sendSignalPush.mockResolvedValue(undefined);
});

describe("deliverSignals", () => {
  it("offers every created signal to push even when every broadcast succeeds and leaves rows unread", async () => {
    const sent = await sendSignal(sender.id, "strong", NOW);
    const ids = sent.signals.map((signal) => signal.id);

    await deliverSignals({
      signals: sent.signals,
      senderName: sender.name,
      level: "strong",
      sentAt: sent.sentAt,
    });

    expect(mocks.broadcast).toHaveBeenCalledTimes(2);
    expect(mocks.sendSignalPush).toHaveBeenCalledWith(ids, sender.name, "strong");
    const rows = await prisma.signal.findMany({ where: { id: { in: ids } }, select: { readAt: true } });
    expect(rows.map((row) => row.readAt)).toEqual([null, null]);
  });

  it("still checks push delivery when one broadcast rejects", async () => {
    const sent = await sendSignal(sender.id, "rescue", new Date(NOW.getTime() + 1));
    const ids = sent.signals.map((signal) => signal.id);
    mocks.broadcast.mockRejectedValueOnce(new Error("realtime unavailable")).mockResolvedValueOnce(true);

    await expect(deliverSignals({
      signals: sent.signals,
      senderName: sender.name,
      level: "rescue",
      sentAt: sent.sentAt,
    })).resolves.toBeUndefined();

    expect(mocks.sendSignalPush).toHaveBeenCalledWith(ids, sender.name, "rescue");
  });
});
