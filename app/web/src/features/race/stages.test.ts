import { describe, expect, it } from "vitest";
import { HOME_THRESHOLD, STAGES, progressOf, stageIndexOf, stageOf } from "./stages";

describe("STAGES", () => {
  it("takes 10000 taps to reach home, thresholds rising monotonically", () => {
    expect(HOME_THRESHOLD).toBe(10000);
    expect(STAGES.map((s) => s.threshold)).toEqual([0, 1500, 3200, 5000, 7300, 10000]);
  });
});

describe("stageOf", () => {
  it("returns the highest stage whose threshold is reached", () => {
    expect(stageOf(0).key).toBe("seat");
    expect(stageOf(1499).key).toBe("seat");
    expect(stageOf(1500).key).toBe("elevator");
    expect(stageOf(4999).key).toBe("lobby");
    expect(stageOf(5000).key).toBe("crosswalk");
    expect(stageOf(7300).key).toBe("subway");
    expect(stageOf(9999).key).toBe("subway");
    expect(stageOf(10000).key).toBe("home");
    expect(stageOf(30000).key).toBe("home");
  });
});

describe("stageIndexOf", () => {
  it("maps thresholds to the 0~5 index stored in daily_run", () => {
    expect(stageIndexOf(0)).toBe(0);
    expect(stageIndexOf(1499)).toBe(0);
    expect(stageIndexOf(1500)).toBe(1);
    expect(stageIndexOf(3200)).toBe(2);
    expect(stageIndexOf(10000)).toBe(5);
    expect(stageIndexOf(25000)).toBe(5);
  });
});

describe("progressOf", () => {
  it("maps taps to a 0~100 track position and clamps at home", () => {
    expect(progressOf(0)).toBe(0);
    expect(progressOf(5000)).toBe(50);
    expect(progressOf(10000)).toBe(100);
    expect(progressOf(15000)).toBe(100);
  });

  it("puts every stage threshold on the track in order", () => {
    const positions = STAGES.map((s) => progressOf(s.threshold));
    expect(positions[0]).toBe(0);
    expect(positions[positions.length - 1]).toBe(100);
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  });
});
