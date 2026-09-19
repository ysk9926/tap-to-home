import { describe, expect, it } from "vitest";
import { stageIndexOf } from "./stages";
import { sortRacers, withRacerCount, type RaceToday, type Racer } from "./race-state";

const racer = (userId: string, tapCount: number, isMe = false): Racer => ({
  userId,
  name: userId,
  username: userId,
  tapCount,
  stage: stageIndexOf(tapCount),
  isMe,
});

describe("stageIndexOf", () => {
  it("maps thresholds to stage index", () => {
    expect(stageIndexOf(0)).toBe(0);
    expect(stageIndexOf(9)).toBe(0);
    expect(stageIndexOf(10)).toBe(1);
    expect(stageIndexOf(100)).toBe(5);
    expect(stageIndexOf(250)).toBe(5);
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
    const next = withRacerCount(data, "me", 12);
    expect(next.me.tapCount).toBe(12);
    expect(next.me.stage).toBe(1);
    expect(next.racers.map((r) => r.userId)).toEqual(["me", "f"]);
    expect(data.me.tapCount).toBe(3); // 원본 불변
  });

  it("updates a friend without touching me", () => {
    const next = withRacerCount(data, "f", 40);
    expect(next.me.tapCount).toBe(3);
    expect(next.racers[0]).toMatchObject({ userId: "f", tapCount: 40, stage: 2 });
  });
});
