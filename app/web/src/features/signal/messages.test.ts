import { describe, expect, it } from "vitest";
import { signalMessage, withJosa } from "./messages";

describe("withJosa", () => {
  it("picks 이/가 by final consonant", () => {
    expect(withJosa("수현", "이", "가")).toBe("수현이");
    expect(withJosa("민지", "이", "가")).toBe("민지가");
    expect(withJosa("Amy", "이", "가")).toBe("Amy가");
  });
});

describe("signalMessage", () => {
  it("builds the F2 copy per level", () => {
    expect(signalMessage("수현", "normal")).toEqual({ name: "수현", suffix: "이도 퇴근하고 싶어 해요", meta: "일반 신호" });
    expect(signalMessage("수현", "strong")).toEqual({ name: "수현", suffix: "이 강하게 퇴근하고 싶어 해요", meta: "5연타" });
    expect(signalMessage("민지", "urgent")).toEqual({ name: "민지", suffix: "가 긴급 퇴근 신호를 보냈어요!", meta: "10연타" });
    expect(signalMessage("민지", "rescue")).toEqual({ name: "민지", suffix: "가 구조 요청을 보냈어요!", meta: "30연타" });
  });
});
