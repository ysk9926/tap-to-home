import { describe, expect, it } from "vitest";
import { stageIndexOf } from "./stages";
import { mergeRaceSnapshot, selectRaceInitial, sortRacers, withRacerCount, type RaceToday, type Racer } from "./race-state";

const racer = (userId: string, tapCount: number, isMe = false): Racer => ({
  userId,
  name: userId,
  username: userId,
  tapCount,
  stage: stageIndexOf(tapCount),
  isMe,
});

describe("race snapshot reconciliation", () => {
  const current: RaceToday = { date: "2026-09-20", me: racer("me", 120, true), racers: [racer("me", 120, true), racer("friend", 50)], settled: false };
  const fresh: RaceToday = { date: "2026-09-20", me: racer("me", 100, true), racers: [racer("me", 100, true), racer("friend", 40)], settled: false };

  it("keeps optimistic taps and newer friend broadcasts while respecting server membership", () => {
    const merged = mergeRaceSnapshot(current, fresh);
    expect(merged.me.tapCount).toBe(120);
    expect(merged.racers.find((entry) => entry.userId === "friend")?.tapCount).toBe(50);
    expect(mergeRaceSnapshot(current, { ...fresh, racers: [fresh.me] }).racers).toHaveLength(1);
  });
  it("uses a new day or settled server snapshot and ignores delayed previous days", () => {
    const settled = { ...fresh, settled: true };
    const next = { ...fresh, date: "2026-09-21", me: racer("me", 0, true), racers: [racer("me", 0, true)] };
    expect(mergeRaceSnapshot(current, settled)).toEqual(settled);
    expect(mergeRaceSnapshot(current, next)).toEqual(next);
    expect(mergeRaceSnapshot(next, current)).toBe(next);
    expect(mergeRaceSnapshot(settled, fresh)).toBe(settled);
  });
  it("only replaces cached data with a newly authoritative initial snapshot", () => {
    expect(selectRaceInitial(current, fresh)).toBe(current);
    expect(selectRaceInitial(current, { ...fresh, settled: true }).settled).toBe(true);
    expect(selectRaceInitial(current, { ...fresh, date: "2026-09-21" }).date).toBe("2026-09-21");
    expect(selectRaceInitial(current, { ...fresh, date: "2026-09-19", settled: true })).toBe(current);
  });
});

describe("sortRacers", () => {
  it("sorts by tapCount desc, then name", () => {
    const sorted = sortRacers([racer("b", 5), racer("a", 5), racer("c", 9)]);
    expect(sorted.map((r) => r.userId)).toEqual(["c", "a", "b"]);
  });
});

describe("withRacerCount", () => {
  const data: RaceToday = {
    date: "2026-09-19",
    me: racer("me", 3, true),
    racers: [racer("f", 5), racer("me", 3, true)],
    settled: false,
  };

  it("updates me, stage, and re-sorts", () => {
    const next = withRacerCount(data, "me", 1600);
    expect(next.me.tapCount).toBe(1600);
    expect(next.me.stage).toBe(1);
    expect(next.racers.map((r) => r.userId)).toEqual(["me", "f"]);
    expect(data.me.tapCount).toBe(3); // 원본 불변
  });

  it("updates a friend without touching me", () => {
    const next = withRacerCount(data, "f", 3500);
    expect(next.me.tapCount).toBe(3);
    expect(next.racers[0]).toMatchObject({ userId: "f", tapCount: 3500, stage: 2 });
  });
});
