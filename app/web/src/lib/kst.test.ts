import { describe, expect, it } from "vitest";
import {
  kstDate,
  kstDateLabel,
  kstHour,
  kstMinutes,
  kstTimeLabel,
  runDateToYmd,
  todayKst,
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
