// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StageStrip } from "./stage-strip";
import { RaceLane } from "./race-lane";
import { RaceScene } from "./race-scene";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(["main", "ranking"])("keeps the %s stride phase stable across repeated taps", (screenType) => {
  function track(count: number, frame: 0 | 1) {
    return screenType === "main" ? <StageStrip count={count} frame={frame} />
      : <RaceLane rank={1} name="나" count={count} frame={frame} />;
  }
  const view = render(track(0, 0));
  view.rerender(track(1, 1));
  const poses = () => [...view.container.querySelectorAll(".race-run-first path:last-child, .race-run-second path:last-child")]
    .map((path) => path.getAttribute("d"));
  const firstStride = poses();
  expect(firstStride).toHaveLength(2);
  expect(firstStride[0]).not.toBe(firstStride[1]);
  act(() => vi.advanceTimersByTime(160));
  view.rerender(track(2, 0));
  expect(poses()).toEqual(firstStride);
});

it("keeps the enlarged preview stride stable when its idle frame changes", () => {
  const view = render(<RaceScene count={1500} running frame={0} />);
  const pose = () => view.container.querySelector(".race-run-first path:last-child")!.getAttribute("d");
  const firstStride = pose();
  view.rerender(<RaceScene count={1500} running frame={1} />);
  expect(pose()).toBe(firstStride);
});

it.each([0, 1500, 3200, 5000, 7300])("preserves character size when leaving the scene at %i", (count) => {
  const view = render(<RaceScene count={count} />);
  const size = () => view.container.querySelector("svg svg")!.getAttribute("height");
  const waitingSize = size();
  view.rerender(<RaceScene count={count} running />);
  expect(size()).toBe(waitingSize);
});

it.each([
  [0, "책상 앞에 앉아 있어요"],
  [1500, "엘리베이터 안에서 기다려요"],
  [3200, "로비 안에서 기다려요"],
  [5000, "신호를 기다려요"],
  [7300, "지하철을 타고 있어요"],
] as const)("returns to the stage's idle scene after tapping at %i", (count, idle) => {
  const view = render(<StageStrip count={count} />);
  expect(screen.getByRole("img", { name: idle })).toBeTruthy();
  view.rerender(<StageStrip count={count + 1} />);
  expect(screen.getByRole("img", { name: /달려/ })).toBeTruthy();
  act(() => vi.advanceTimersByTime(600));
  view.rerender(<StageStrip count={count + 2} />);
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByRole("img", { name: /달려/ })).toBeTruthy();
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole("img", { name: idle })).toBeTruthy();
});

it("lies in bed at home and never resumes running for completed counts", () => {
  const view = render(<StageStrip count={9999} />);
  view.rerender(<StageStrip count={10000} />);
  expect(screen.getByRole("img", { name: "집에서 침대에 누워 쉬어요" })).toBeTruthy();
  view.rerender(<StageStrip count={10001} />);
  expect(screen.queryByRole("img", { name: /달려/ })).toBeNull();
  view.rerender(<StageStrip count={0} />);
  expect(screen.getByRole("img", { name: "책상 앞에 앉아 있어요" })).toBeTruthy();
});

it("animates a friend's incoming count in the ranking then returns to idle", () => {
  const view = render(<RaceLane rank={1} name="친구" count={7300} />);
  view.rerender(<RaceLane rank={1} name="친구" count={7305} />);
  expect(screen.getByRole("img", { name: /달려/ })).toBeTruthy();
  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByRole("img", { name: "지하철을 타고 있어요" })).toBeTruthy();
});
