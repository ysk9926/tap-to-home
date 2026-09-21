// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { AdminUserDetail } from "../types";
import { UserDetailView } from "./user-detail-view";

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

function renderDetail(relationships: Pick<AdminUserDetail, "friends" | "blockedUsers">) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData<AdminUserDetail>(["admin", "master", "user", "target"], {
    user: {
      id: "target", username: "target", name: "조회 대상", createdAt: "2026-09-01T00:00:00Z",
      status: "active", suspendedAt: null, suspensionReason: null, analyticsExcluded: false,
      lastSeenAt: null, lastTapAt: null, friendCount: 1, tapCount: 0,
    },
    runs: [], titles: [], audit: [], ...relationships,
  });
  render(<QueryClientProvider client={client}><UserDetailView adminId="master" userId="target" /></QueryClientProvider>);
}

it("renders separate relationship tables with KST timestamps, account states, and detail links", () => {
  renderDetail({
    friends: [
      { id: "friend-one", username: "friend_one", name: "퇴근 동료", status: "active", acceptedAt: "2026-09-20T15:30:00Z" },
      { id: "friend-old", username: "friend_old", name: "이전 동료", status: "suspended", acceptedAt: null },
    ],
    blockedUsers: [{ id: "blocked-one", username: "blocked_one", name: "차단 상대", status: "deleted", blockedAt: "2026-09-20T16:00:00Z" }],
  });
  const friends = within(screen.getByRole("table", { name: "친구 목록" }));
  expect(friends.getByRole("link", { name: "퇴근 동료" }).getAttribute("href")).toBe("/admin/users/friend-one");
  expect(friends.getByText("@friend_one")).toBeTruthy();
  expect(friends.getByText("2026. 09. 21. 오전 12:30")).toBeTruthy();
  expect(friends.getByText("기록 없음")).toBeTruthy();
  expect(friends.getByText("이용 정지")).toBeTruthy();
  expect(friends.queryByText("차단 상대")).toBeNull();

  const blocked = within(screen.getByRole("table", { name: "차단한 사람 목록" }));
  expect(blocked.getByRole("link", { name: "차단 상대" }).getAttribute("href")).toBe("/admin/users/blocked-one");
  expect(blocked.getByText("2026. 09. 21. 오전 01:00")).toBeTruthy();
  expect(blocked.getByText("탈퇴")).toBeTruthy();
  expect(blocked.queryByText("퇴근 동료")).toBeNull();
});

it("explains empty friend and block lists independently", () => {
  renderDetail({ friends: [], blockedUsers: [] });
  expect(screen.getByText("현재 친구가 없어요.")).toBeTruthy();
  expect(screen.getByText("이 사용자가 차단한 사람이 없어요.")).toBeTruthy();
});
