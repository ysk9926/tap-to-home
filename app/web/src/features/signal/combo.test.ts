import { describe, expect, it } from "vitest";
import { createComboTracker, levelForTaps } from "./combo";

describe("levelForTaps", () => {
  it("maps thresholds 1/5/10/30", () => {
    expect(levelForTaps(0)).toBeNull();
    expect(levelForTaps(1)).toBe("normal");
    expect(levelForTaps(4)).toBe("normal");
    expect(levelForTaps(5)).toBe("strong");
    expect(levelForTaps(10)).toBe("urgent");
    expect(levelForTaps(29)).toBe("urgent");
    expect(levelForTaps(30)).toBe("rescue");
  });
});

describe("createComboTracker", () => {
  it("groups taps within 1.5s and emits the highest level once", () => {
    const c = createComboTracker();
    for (let i = 0; i < 10; i++) c.tap(i * 100);
    expect(c.settle(1000)).toBeNull(); // 아직 창 안
    expect(c.settle(900 + 1500)).toBeNull(); // 경계: 마지막 탭 + 1500 은 아직 안 지남
    expect(c.settle(900 + 1501)).toBe("urgent");
    expect(c.settle(5000)).toBeNull(); // 한 번만
  });

  it("a gap over the window starts a new combo", () => {
    const c = createComboTracker();
    c.tap(0);
    c.tap(100);
    c.tap(2000); // 새 묶음
    expect(c.count()).toBe(1);
    expect(c.settle(3600)).toBe("normal");
  });

  it("emits normal for a single tap", () => {
    const c = createComboTracker();
    c.tap(0);
    expect(c.settle(1600)).toBe("normal");
  });
});
