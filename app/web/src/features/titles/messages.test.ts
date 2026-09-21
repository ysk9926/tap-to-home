import { describe, expect, it } from "vitest";
import { settlementMessage } from "./messages";

describe("settlementMessage", () => {
  it("leads with the primary title when there is one", () => {
    const msg = settlementMessage("heart_already_home", 5000);
    expect(msg.body).toContain("마음만 이미 집에 있음");
  });

  it("falls back to the tap count with a thousands separator", () => {
    const msg = settlementMessage(null, 1204);
    expect(msg.body).toBe("어제 1,204번 퇴근하고 싶었어요");
  });
});
