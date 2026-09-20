import { describe, expect, it } from "vitest";
import {
  kstDate,
  kstDateLabel,
  kstHour,
  kstMinutes,
  kstTimeLabel,
  runDateToYmd,
  todayKst,
  yesterdayKstDate,
} from "./kst";

describe("kst", () => {
  it("todayKst rolls over at 15:00 UTC", () => {
    expect(todayKst(new Date("2026-09-19T14:59:59Z"))).toBe("2026-09-19");
    expect(todayKst(new Date("2026-09-19T15:00:00Z"))).toBe("2026-09-20");
  });

  it("kstDate is UTC midnight of the KST date", () => {
    expect(kstDate(new Date("2026-09-19T20:00:00Z")).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("runDateToYmd reads a @db.Date value back", () => {
    expect(runDateToYmd(new Date("2026-09-20T00:00:00.000Z"))).toBe("2026-09-20");
  });

  it("kstHour / kstMinutes", () => {
    const d = new Date("2026-09-19T00:32:00Z"); // 09:32 KST
    expect(kstHour(d)).toBe(9);
    expect(kstMinutes(d)).toBe(9 * 60 + 32);
  });

  it("labels", () => {
    expect(kstTimeLabel(new Date("2026-09-19T00:32:00Z"))).toBe("09:32");
    expect(kstDateLabel("2026-09-19")).toBe("9월 19일 토요일");
  });
});

describe("yesterdayKstDate", () => {
  it("returns the previous KST day at UTC midnight", () => {
    // 2026-09-20 00:05 KST = 2026-09-19 15:05 UTC
    const at = new Date("2026-09-19T15:05:00Z");
    expect(yesterdayKstDate(at).toISOString()).toBe("2026-09-19T00:00:00.000Z");
  });

  it("does not cross a month boundary incorrectly", () => {
    const at = new Date("2026-09-30T15:05:00Z"); // 10-01 00:05 KST
    expect(yesterdayKstDate(at).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});
