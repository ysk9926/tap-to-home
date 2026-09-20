import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createReconciler } from "./reconciler";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("coalesces visibility, network and realtime recovery", async () => {
  const run = vi.fn(async () => {});
  const reconciler = createReconciler({ canRun: () => true, run });
  reconciler.request("resume");
  reconciler.request("online");
  reconciler.request("realtime");
  await vi.advanceTimersByTimeAsync(100);
  expect(run).toHaveBeenCalledTimes(1);
  reconciler.dispose();
});

it("defers while hidden and coalesces requests received during an in-flight correction", async () => {
  let visible = false;
  let resolve: () => void = () => {};
  const run = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  const reconciler = createReconciler({ canRun: () => visible, run });
  reconciler.request("realtime");
  await vi.advanceTimersByTimeAsync(200);
  expect(run).not.toHaveBeenCalled();
  visible = true;
  reconciler.request("resume");
  await vi.advanceTimersByTimeAsync(100);
  reconciler.request("online");
  reconciler.request("midnight");
  await vi.advanceTimersByTimeAsync(300);
  expect(run).toHaveBeenCalledTimes(1);
  resolve();
  await vi.advanceTimersByTimeAsync(100);
  expect(run).toHaveBeenCalledTimes(2);
  reconciler.dispose();
  resolve();
});

it("cancels queued work on disposal and survives a failed correction", async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const reconciler = createReconciler({ canRun: () => true, run });
  reconciler.request("resume");
  await vi.advanceTimersByTimeAsync(100);
  reconciler.request("online");
  await vi.advanceTimersByTimeAsync(100);
  expect(run).toHaveBeenCalledTimes(2);
  reconciler.request("midnight");
  reconciler.dispose();
  await vi.advanceTimersByTimeAsync(100);
  expect(run).toHaveBeenCalledTimes(2);
});
