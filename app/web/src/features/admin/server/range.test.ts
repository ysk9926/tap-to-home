import { describe, expect, it } from "vitest";
import { parseRange } from "./range";

describe("parseRange", () => {
  it("defaults to the seven completed KST dates before today", () => {
    expect(parseRange(new URLSearchParams(), new Date("2026-09-20T14:59:59Z"))).toEqual({
      from: "2026-09-13",
      to: "2026-09-19",
      days: 7,
    });

    expect(parseRange(new URLSearchParams(), new Date("2026-09-20T15:00:00Z"))).toEqual({
      from: "2026-09-14",
      to: "2026-09-20",
      days: 7,
    });
  });

  it("accepts an inclusive range of at most 90 days including today", () => {
    expect(
      parseRange(
        new URLSearchParams({ from: "2026-06-23", to: "2026-09-20" }),
        new Date("2026-09-20T01:00:00Z"),
      ),
    ).toEqual({ from: "2026-06-23", to: "2026-09-20", days: 90 });
  });

  it.each([
    [{ from: "2026-09-01" }, "from과 to"],
    [{ from: "2026-9-01", to: "2026-09-02" }, "YYYY-MM-DD"],
    [{ from: "2026-02-30", to: "2026-03-01" }, "올바른 날짜"],
    [{ from: "2026-09-03", to: "2026-09-02" }, "시작일"],
    [{ from: "2026-06-22", to: "2026-09-20" }, "90일"],
    [{ from: "2026-09-20", to: "2026-09-21" }, "오늘 이후"],
  ])("rejects an invalid range %#", (input, message) => {
    expect(() =>
      parseRange(new URLSearchParams(input), new Date("2026-09-20T01:00:00Z")),
    ).toThrow(message);
  });

  it("uses RangeError so API handlers can return a client error", () => {
    expect(() =>
      parseRange(
        new URLSearchParams({ from: "2031-01-02", to: "2031-01-01" }),
        new Date("2031-01-03T00:00:00Z"),
      ),
    ).toThrow(RangeError);
  });
});
