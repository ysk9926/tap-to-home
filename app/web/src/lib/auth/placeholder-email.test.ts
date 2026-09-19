import { expect, it } from "vitest";
import { placeholderEmail } from "./placeholder-email";

it("builds a lowercase placeholder email from the username", () => {
  expect(placeholderEmail("Seung_Gyu")).toBe("seung_gyu@id.tap-to-home.local");
  expect(placeholderEmail("  abc ")).toBe("abc@id.tap-to-home.local");
});
