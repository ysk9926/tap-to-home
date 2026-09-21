import { describe, expect, it } from "vitest";
import { evaluateTitles, peakHour, pickPrimary, type TapSample } from "./evaluate";

/** "HH:MM" KST 에 n 탭 */
const at = (hhmm: string, batchSize: number): TapSample => {
  const [h, m] = hhmm.split(":").map(Number);
  return { tappedAt: new Date(Date.UTC(2026, 8, 19, h - 9, m)), batchSize };
};

describe("evaluateTitles", () => {
  it("early_leaver: first tap before 09:30 KST", () => {
    const taps = [at("09:29", 3), at("11:00", 7)];
    expect(evaluateTitles({ taps, total: 10, firstTapAt: taps[0].tappedAt })).toContain("early_leaver");
    const late = [at("09:30", 10)];
    expect(evaluateTitles({ taps: late, total: 10, firstTapAt: late[0].tappedAt })).not.toContain("early_leaver");
  });

  it("post_lunch_slump: 60%+ of taps at 13:00 or later", () => {
    const taps = [at("10:00", 4), at("14:00", 6)];
    expect(evaluateTitles({ taps, total: 10, firstTapAt: taps[0].tappedAt })).toContain("post_lunch_slump");
    const morning = [at("10:00", 5), at("14:00", 5)];
    expect(evaluateTitles({ taps: morning, total: 10, firstTapAt: morning[0].tappedAt })).not.toContain("post_lunch_slump");
  });

  it("last_hour_sprinter: 1500+ taps at 17:00 or later", () => {
    const taps = [at("17:05", 1500)];
    expect(evaluateTitles({ taps, total: 1500, firstTapAt: taps[0].tappedAt })).toContain("last_hour_sprinter");
    const under = [at("17:05", 1499)];
    expect(evaluateTitles({ taps: under, total: 1499, firstTapAt: under[0].tappedAt })).not.toContain("last_hour_sprinter");
  });

  it("heart_already_home when the race reaches home (5000), bearable_day under 500 (but not 0)", () => {
    const big = [at("12:00", 5000)];
    expect(evaluateTitles({ taps: big, total: 5000, firstTapAt: big[0].tappedAt })).toContain("heart_already_home");
    const almost = [at("12:00", 4999)];
    expect(evaluateTitles({ taps: almost, total: 4999, firstTapAt: almost[0].tappedAt })).not.toContain("heart_already_home");
    const small = [at("12:00", 499)];
    expect(evaluateTitles({ taps: small, total: 499, firstTapAt: small[0].tappedAt })).toContain("bearable_day");
    const notSmall = [at("12:00", 500)];
    expect(evaluateTitles({ taps: notSmall, total: 500, firstTapAt: notSmall[0].tappedAt })).not.toContain("bearable_day");
    expect(evaluateTitles({ taps: [], total: 0, firstTapAt: null })).toEqual([]);
  });

  it("awards every matching title", () => {
    const taps = [at("09:00", 1), at("17:30", 4999)];
    const ids = evaluateTitles({ taps, total: 5000, firstTapAt: taps[0].tappedAt });
    expect(ids).toEqual(expect.arrayContaining(["early_leaver", "post_lunch_slump", "last_hour_sprinter", "heart_already_home"]));
    expect(ids).not.toContain("bearable_day");
  });
});

describe("pickPrimary", () => {
  it("chooses the lowest priority number", () => {
    expect(pickPrimary(["bearable_day", "early_leaver"])).toBe("early_leaver");
    expect(pickPrimary(["early_leaver", "heart_already_home"])).toBe("heart_already_home");
    expect(pickPrimary([])).toBeNull();
  });
});

describe("peakHour", () => {
  it("returns the KST hour with the most taps", () => {
    expect(peakHour([at("10:10", 3), at("16:20", 7), at("16:50", 2)])).toBe(16);
    expect(peakHour([])).toBeNull();
  });
});
