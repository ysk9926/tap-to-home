import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTapBatcher } from "./tap-batcher";

describe("createTapBatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collects taps within the delay into one send", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.tap();
    b.tap();
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(3);
    expect(b.pending()).toBe(0);
  });

  it("does not overlap sends; taps during a send go to the next batch", async () => {
    let resolveFirst!: () => void;
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (resolveFirst = r)))
      .mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledWith(1);
    b.tap();
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledTimes(1); // 아직 첫 전송 중
    resolveFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(2);
  });

  it("re-queues the count when send fails", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(b.pending()).toBe(2);
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenLastCalledWith(3);
    expect(b.pending()).toBe(0);
  });

  it("dispose cancels the pending timer", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).not.toHaveBeenCalled();
  });
});
