// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RaceToday } from "../race-state";
import { RaceScreen } from "./race-screen";

vi.mock("../hooks/use-race-session", () => ({
  useRaceSession: (initial: RaceToday) => ({ data: initial }),
}));
vi.mock("../hooks/use-tap", () => ({
  useTap: () => ({ tap: vi.fn(), frame: 0 }),
}));
afterEach(cleanup);

const me = { userId: "me", username: "me", name: "나", tapCount: 300, stage: 0, isMe: true };
const friends = ["민경", "수현", "민지"].map((name, index) => ({
  userId: `friend-${index}`, username: `friend_${index}`, name,
  tapCount: 200 - index * 50, stage: 0, isMe: false,
}));
const initial: RaceToday = { date: "2026-09-21", me, racers: [me, ...friends], settled: false };

it("shows the leading two friends when enabled", () => {
  render(<RaceScreen initial={initial} showTopFriendRails />);
  const rails = within(screen.getByRole("region", { name: "친구 상위 랭킹" }));
  expect(rails.getByText("민경")).toBeTruthy();
  expect(rails.getByText("수현")).toBeTruthy();
  expect(rails.queryByText("민지")).toBeNull();
});

it("hides the friend rails when disabled and restores them when enabled", () => {
  const { rerender } = render(<RaceScreen initial={initial} showTopFriendRails={false} />);
  expect(screen.queryByRole("region", { name: "친구 상위 랭킹" })).toBeNull();
  expect(screen.getByRole("link", { name: /랭킹 →/ }).getAttribute("href")).toBe("/ranking");
  expect(screen.getByRole("button", { name: /퇴근하고 싶다/ })).toBeTruthy();
  rerender(<RaceScreen initial={initial} showTopFriendRails />);
  expect(screen.getByRole("region", { name: "친구 상위 랭킹" })).toBeTruthy();
});

it("keeps the add-friends prompt when there are no friends", () => {
  render(<RaceScreen initial={{ ...initial, racers: [me] }} showTopFriendRails={false} />);
  expect(screen.queryByRole("region", { name: "친구 상위 랭킹" })).toBeNull();
  expect(screen.getByRole("link", { name: /아이디로 친구 등록하기/ }).getAttribute("href")).toBe("/friends");
});
