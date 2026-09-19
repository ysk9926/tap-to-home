import { describe, expect, it } from "vitest";
import { HOME_THRESHOLD, STAGES, progressOf, stageIndexOf, stageOf } from "./stages";

describe("STAGES", () => {
  it("takes 300 taps to reach home, thresholds rising monotonically", () => {
    expect(HOME_THRESHOLD).toBe(300);
    expect(STAGES.map((s) => s.threshold)).toEqual([0, 45, 95, 150, 220, 300]);
  });
});

describe("stageOf", () => {
  it("returns the highest stage whose threshold is reached", () => {
    expect(stageOf(0).key).toBe("seat");
    expect(stageOf(44).key).toBe("seat");
    expect(stageOf(45).key).toBe("elevator");
    expect(stageOf(149).key).toBe("lobby");
    expect(stageOf(150).key).toBe("crosswalk");
    expect(stageOf(220).key).toBe("subway");
    expect(stageOf(299).key).toBe("subway");
    expect(stageOf(300).key).toBe("home");
    expect(stageOf(1000).key).toBe("home");
  });
});

describe("stageIndexOf", () => {
  it("maps thresholds to the 0~5 index stored in daily_run", () => {
    expect(stageIndexOf(0)).toBe(0);
    expect(stageIndexOf(44)).toBe(0);
    expect(stageIndexOf(45)).toBe(1);
    expect(stageIndexOf(95)).toBe(2);
    expect(stageIndexOf(300)).toBe(5);
    expect(stageIndexOf(750)).toBe(5);
  });
});

describe("progressOf", () => {
  it("maps taps to a 0~100 track position and clamps at home", () => {
    expect(progressOf(0)).toBe(0);
    expect(progressOf(150)).toBe(50);
    expect(progressOf(300)).toBe(100);
    expect(progressOf(450)).toBe(100);
  });

  it("puts every stage threshold on the track in order", () => {
    const positions = STAGES.map((s) => progressOf(s.threshold));
    expect(positions[0]).toBe(0);
    expect(positions[positions.length - 1]).toBe(100);
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });
});
