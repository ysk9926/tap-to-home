// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { FriendsState } from "../server/friends-state";
import { FriendRequestWatcher } from "./friend-request-watcher";

/**
 * 이 테스트가 지키는 것: 안 본 정산 결과가 있는 동안 친구 요청 다이얼로그가 열리지 않는다.
 *
 * 두 다이얼로그 모두 네이티브 `<dialog>` + `showModal()` 이라, 동시에 열리면 showModal() 을
 * 나중에 호출한 쪽이 top layer 위로 올라간다. 레이아웃의 DOM 순서만으로는 정산 결과를 먼저
 * 보여줄 수 없어서 `settlementPending` 게이트를 뒀다. 게이트가 "쓸모없는 조건" 으로 보여
 * 지워지면 정산 결과가 친구 요청에 가려지므로, 여기서 못을 박는다.
 */

const incoming: FriendsState["incoming"] = [
  {
    id: "req-1",
    user: { id: "friend", username: "friend", name: "친구" },
    createdAt: "2026-09-20T00:00:00.000Z",
  },
];

const liveSync = vi.hoisted(() => ({
  state: { userId: "me", friends: {} as FriendsState },
}));
vi.mock("@/features/realtime/live-sync-context", () => ({
  useLiveSync: () => liveSync.state,
}));

// jsdom 은 <dialog> 의 showModal()/close() 를 구현하지 않는다. MarkerDialog 가 부르는 대로
// open 속성만 반영하는 최소 스텁을 둔다 — 이 테스트가 보는 것은 "열렸는가" 뿐이다.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

function renderWatcher(settlementPending: boolean) {
  liveSync.state.friends = { friends: [], incoming, outgoing: [], blocked: [] };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FriendRequestWatcher settlementPending={settlementPending} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

it("opens for a pending request when no settlement result is waiting", () => {
  renderWatcher(false);
  expect(screen.getByRole("dialog")).toHaveProperty("open", true);
});

it("stays shut while an unseen settlement result is waiting", () => {
  renderWatcher(true);
  // 요청은 그대로 있지만 다이얼로그는 열리지 않는다 — 정산 결과가 먼저다
  expect(screen.getByRole("dialog", { hidden: true })).toHaveProperty("open", false);
});
