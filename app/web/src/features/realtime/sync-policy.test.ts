import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/fetch-json";
import { getQueryPolicy, retrySyncQuery } from "./sync-policy";

describe("query policy", () => {
  it.each([
    ["race", false, 2_000, 30_000],
    ["friends", false, 20_000, 60_000],
    ["signals", false, 5_000, 60_000],
    ["race", true, 60_000, 30_000],
    ["friends", true, 60_000, 60_000],
    ["signals", true, 60_000, 60_000],
  ] as const)("uses %s health=%s to select background reconciliation", (domain, connected, interval, staleTime) => {
    expect(getQueryPolicy({ domain, connected, visible: true, online: true, active: true })).toEqual({
      enabled: true, staleTime, refetchInterval: interval,
    });
  });

  it.each(["visible", "online", "active"] as const)("stops new reads when %s is false", (flag) => {
    for (const domain of ["race", "friends", "signals"] as const) {
      expect(getQueryPolicy({ domain, connected: false, visible: true, online: true, active: true, [flag]: false }))
        .toMatchObject({ enabled: false, refetchInterval: false });
    }
  });

  it("does not retry client errors and bounds transient failures", () => {
    expect(retrySyncQuery(0, new ApiError(401, "expired"))).toBe(false);
    expect(retrySyncQuery(0, new ApiError(403, "forbidden"))).toBe(false);
    expect(retrySyncQuery(0, new ApiError(503, "unavailable"))).toBe(true);
    expect(retrySyncQuery(1, new TypeError("offline"))).toBe(true);
    expect(retrySyncQuery(2, new TypeError("offline"))).toBe(false);
  });
});
