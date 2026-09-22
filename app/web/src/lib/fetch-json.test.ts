// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchJson } from "./fetch-json";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("notifies the app when an authenticated request returns 401", async () => {
  const expired = vi.fn();
  window.addEventListener("tap-to-home:session-expired", expired, { once: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: "로그인이 필요해요" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  ));

  await expect(fetchJson("/api/taps")).rejects.toMatchObject({ status: 401 });

  expect(expired).toHaveBeenCalledOnce();
});

it("aborts a request that has not completed after ten seconds", async () => {
  let requestSignal: AbortSignal | null | undefined;
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    requestSignal = init?.signal;
    return new Promise<Response>(() => {});
  }));

  void fetchJson("/api/race/today");
  await vi.advanceTimersByTimeAsync(10_000);

  expect(requestSignal?.aborted).toBe(true);
  expect(requestSignal?.reason).toHaveProperty("name", "TimeoutError");
});
