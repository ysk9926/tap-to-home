// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { raceTodayKey } from "@/features/realtime/query-keys";
import type { RaceToday } from "../race-state";
import { useTap } from "./use-tap";

let client: QueryClient;
let sent: number[];
function seed(count: number, settled = false, date = "2026-09-20") {
  const me = { userId: "me", username: "me", name: "나", tapCount: count, stage: 4, isMe: true };
  client.setQueryData<RaceToday>(raceTodayKey("me"), { date, settled, me, racers: [me] });
}
function wrapper({ children }: { children: ReactNode }) {
  return <StrictMode><QueryClientProvider client={client}>{children}</QueryClientProvider></StrictMode>;
}
beforeEach(() => {
  vi.useFakeTimers();
  client = new QueryClient(); sent = [];
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)).count);
    return new Response(JSON.stringify({ tapCount: 10000, stage: 5, date: "2026-09-20" }));
  });
});
afterEach(() => { cleanup(); client.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("accepts only the last tap even when multiple taps happen before rerender", async () => {
  seed(9999);
  const onTap = vi.fn();
  const { result } = renderHook(() => useTap({ userId: "me", date: "2026-09-20", onTap }), { wrapper });
  act(() => { result.current.tap(); result.current.tap(); result.current.tap(); });
  expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.me.tapCount).toBe(10000);
  expect(onTap).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  expect(sent).toEqual([1]);
});

it("does not let yesterday's final response lock a new day's race", async () => {
  seed(9999);
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(({ date }) => useTap({ userId: "me", date }), {
    wrapper, initialProps: { date: "2026-09-20" },
  });
  act(() => result.current.tap());
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  act(() => seed(0, false, "2026-09-21"));
  rerender({ date: "2026-09-21" });
  await act(async () => { finish(new Response(JSON.stringify({ tapCount: 10000, stage: 5, date: "2026-09-20" }))); });
  expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.me.tapCount).toBe(0);
  act(() => result.current.tap());
  expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.me.tapCount).toBe(1);
});

it.each([{ count: 10000, settled: false }, { count: 12000, settled: false }, { count: 50, settled: true }])(
  "ignores completed runs: $count taps, settled=$settled", async ({ count, settled }) => {
    seed(count, settled);
    const onTap = vi.fn();
    const { result, rerender } = renderHook(({ date }) => useTap({ userId: "me", date, onTap }), {
      wrapper, initialProps: { date: "2026-09-20" },
    });
    act(() => result.current.tap());
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(sent).toEqual([]);
    expect(onTap).not.toHaveBeenCalled();
    expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.me.tapCount).toBe(count);
    act(() => seed(0, false, "2026-09-21"));
    rerender({ date: "2026-09-21" });
    act(() => result.current.tap());
    expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.me.tapCount).toBe(1);
  },
);
