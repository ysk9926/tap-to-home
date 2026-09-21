// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { updateRaceDisplayAction } from "../actions";
import { FriendRailsSwitch } from "./friend-rails-switch";

vi.mock("../actions", () => ({ updateRaceDisplayAction: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function SavedPreference({ initial = true }: { initial?: boolean }) {
  const [saved, setSaved] = useState(initial);
  return <FriendRailsSwitch showTopFriendRails={saved} saveAction={async (data) => {
    await updateRaceDisplayAction(data);
    setSaved(data.get("showTopFriendRails") === "on");
  }} />;
}

it("updates immediately, blocks duplicate changes while saving, and keeps the saved value", async () => {
  let finish: () => void = () => {};
  vi.mocked(updateRaceDisplayAction).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<SavedPreference />);
  const toggle = screen.getByRole<HTMLInputElement>("switch", { name: "친구 TOP2 레일 표시" });
  expect(toggle.checked).toBe(true);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(toggle.disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("저장 중");
  expect(vi.mocked(updateRaceDisplayAction).mock.calls[0][0].has("showTopFriendRails")).toBe(false);
  await act(async () => { finish(); });
  expect(toggle.checked).toBe(false);
  expect(toggle.disabled).toBe(false);
});

it.each([true, false])("restores the saved state after failure (initial=%s) and allows retry", async (initial) => {
  vi.mocked(updateRaceDisplayAction).mockRejectedValueOnce(new Error("offline"));
  render(<SavedPreference initial={initial} />);
  const toggle = screen.getByRole<HTMLInputElement>("switch", { name: "친구 TOP2 레일 표시" });
  await act(async () => { fireEvent.click(toggle); });
  expect(toggle.checked).toBe(initial);
  expect(toggle.disabled).toBe(false);
  expect(screen.getByRole("alert").textContent).toContain("설정을 저장하지 못했어요");
  vi.mocked(updateRaceDisplayAction).mockResolvedValueOnce();
  await act(async () => { fireEvent.click(toggle); });
  expect(toggle.checked).toBe(!initial);
  expect(screen.queryByRole("alert")).toBeNull();
});
