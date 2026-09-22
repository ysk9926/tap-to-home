// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityTracker } from "./activity-tracker";

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  document.dispatchEvent(new Event("visibilitychange"));
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

beforeEach(() => {
  vi.useFakeTimers();
  setOnline(true);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ActivityTracker", () => {
  it("reports an expired session from the activity mutation", async () => {
    const expired = vi.fn();
    window.addEventListener("tap-to-home:session-expired", expired, { once: true });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

    render(<ActivityTracker userId="one" />);
    await act(async () => {});

    expect(expired).toHaveBeenCalledOnce();
  });

  it("collects on mount and throttles visible resumes to five minutes", async () => {
    render(<ActivityTracker userId="one" />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);

    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("waits offline, retries when online, and resets for an account switch", async () => {
    setOnline(false);
    const view = render(<ActivityTracker userId="one" />);
    expect(fetch).not.toHaveBeenCalled();

    setOnline(true);
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(fetch).toHaveBeenCalledTimes(1);

    view.rerender(<ActivityTracker userId="two" />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("collects immediately when the KST date changes", async () => {
    vi.setSystemTime(new Date("2026-09-20T14:59:59.000Z"));
    render(<ActivityTracker userId="one" />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a failed observation while the app remains visible and online", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<ActivityTracker userId="one" />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(30 * 1000));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight request when unmounted", async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(fetch).mockImplementation((_input, init) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    });
    const view = render(<ActivityTracker userId="one" />);
    await act(async () => {});
    expect(signal).toBeDefined();
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
