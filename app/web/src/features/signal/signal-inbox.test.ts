import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/fetch-json";
import type { SignalPayload } from "@/features/realtime/channels";
import { createSignalInbox } from "./signal-inbox";

const SIGNAL: SignalPayload = {
  id: "signal-1",
  senderName: "퇴근요정",
  level: "urgent",
  sentAt: "2026-09-20T03:00:00.000Z",
};

describe("createSignalInbox", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("toasts a realtime signal once and suppresses the same poll signal for 10 minutes", async () => {
    let now = Date.parse(SIGNAL.sentAt);
    const onToast = vi.fn();
    const acknowledge = vi.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined);
    const inbox = createSignalInbox({ now: () => now, visible: () => true, onToast, acknowledge });

    try {
      expect(inbox.accept(SIGNAL, "realtime")).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      now += 4_000;
      expect(inbox.accept(SIGNAL, "poll")).toBe(false);

      expect(onToast).toHaveBeenCalledTimes(1);
      expect(acknowledge).toHaveBeenCalledWith([SIGNAL.id]);
    } finally {
      inbox.dispose();
    }
  });

  it("does not consume, toast, or acknowledge realtime signals while hidden", async () => {
    const onToast = vi.fn();
    const acknowledge = vi.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined);
    const inbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => false,
      onToast,
      acknowledge,
    });

    try {
      expect(inbox.accept(SIGNAL, "realtime")).toBe(false);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onToast).not.toHaveBeenCalled();
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      inbox.dispose();
    }
  });

  it("does not toast or acknowledge signals older than 10 minutes", async () => {
    const onToast = vi.fn();
    const acknowledge = vi.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined);
    const inbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt) + 10 * 60_000 + 1,
      visible: () => true,
      onToast,
      acknowledge,
    });

    try {
      expect(inbox.accept(SIGNAL, "realtime")).toBe(false);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onToast).not.toHaveBeenCalled();
      expect(acknowledge).not.toHaveBeenCalled();
    } finally {
      inbox.dispose();
    }
  });

  it("batches acknowledgements after 100ms with at most 50 IDs per request", async () => {
    const acknowledge = vi.fn<(ids: string[]) => Promise<void>>().mockResolvedValue(undefined);
    const inbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => true,
      onToast: vi.fn(),
      acknowledge,
    });

    try {
      for (let index = 0; index < 51; index += 1) {
        inbox.accept({ ...SIGNAL, id: `signal-${index}` }, "realtime");
      }
      await vi.advanceTimersByTimeAsync(99);
      expect(acknowledge).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);

      expect(acknowledge).toHaveBeenCalledTimes(2);
      expect(acknowledge.mock.calls[0]?.[0]).toHaveLength(50);
      expect(acknowledge.mock.calls[1]?.[0]).toEqual(["signal-50"]);
    } finally {
      inbox.dispose();
    }
  });

  it("retries network and 5xx failures after 1s and 2s", async () => {
    const acknowledge = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce(new ApiError(503, "unavailable"))
      .mockResolvedValue(undefined);
    const inbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => true,
      onToast: vi.fn(),
      acknowledge,
    });

    try {
      inbox.accept(SIGNAL, "realtime");
      await vi.advanceTimersByTimeAsync(100);
      expect(acknowledge).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(acknowledge).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(acknowledge).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(acknowledge).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(acknowledge).toHaveBeenCalledTimes(3);
    } finally {
      inbox.dispose();
    }
  });

  it("does not retry 4xx failures and keeps the displayed ID deduplicated", async () => {
    let now = Date.parse(SIGNAL.sentAt);
    const onToast = vi.fn();
    const acknowledge = vi.fn().mockRejectedValue(new ApiError(400, "bad request"));
    const inbox = createSignalInbox({ now: () => now, visible: () => true, onToast, acknowledge });

    try {
      expect(inbox.accept(SIGNAL, "realtime")).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(10_000);
      now += 20_000;
      expect(inbox.accept(SIGNAL, "realtime")).toBe(false);
      expect(acknowledge).toHaveBeenCalledTimes(1);
      expect(onToast).toHaveBeenCalledTimes(1);
    } finally {
      inbox.dispose();
    }
  });

  it("does not retry non-5xx HTTP failures", async () => {
    const acknowledge = vi.fn().mockRejectedValue(new ApiError(302, "redirected"));
    const inbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => true,
      onToast: vi.fn(),
      acknowledge,
    });

    try {
      inbox.accept(SIGNAL, "realtime");
      await vi.advanceTimersByTimeAsync(3_100);
      expect(acknowledge).toHaveBeenCalledTimes(1);
    } finally {
      inbox.dispose();
    }
  });

  it("stops retrying when hidden or disposed", async () => {
    let visible = true;
    const acknowledge = vi.fn().mockRejectedValue(new TypeError("offline"));
    const hiddenInbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => visible,
      onToast: vi.fn(),
      acknowledge,
    });
    hiddenInbox.accept(SIGNAL, "realtime");
    await vi.advanceTimersByTimeAsync(100);
    visible = false;
    await vi.advanceTimersByTimeAsync(3_000);
    expect(acknowledge).toHaveBeenCalledTimes(1);
    hiddenInbox.dispose();

    visible = true;
    const disposedInbox = createSignalInbox({
      now: () => Date.parse(SIGNAL.sentAt),
      visible: () => visible,
      onToast: vi.fn(),
      acknowledge,
    });
    disposedInbox.accept({ ...SIGNAL, id: "signal-2" }, "realtime");
    await vi.advanceTimersByTimeAsync(100);
    disposedInbox.dispose();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(acknowledge).toHaveBeenCalledTimes(2);
  });
});
