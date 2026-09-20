// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TapButton } from "./tap-button";

afterEach(cleanup);

it("blocks pointer, keyboard and assistive activation after arriving home and explains why", () => {
  const onTap = vi.fn();
  render(<TapButton onTap={onTap} completed />);
  const button = screen.getByRole("button", { name: "이미 퇴근했습니다" });
  expect(button.getAttribute("aria-disabled")).toBe("true");
  fireEvent.pointerDown(button);
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.keyDown(button, { key: " " });
  fireEvent.click(button, { detail: 0 });
  expect(onTap).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("이미 퇴근했습니다");
});
