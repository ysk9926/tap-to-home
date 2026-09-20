// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fakeSupabase } from "../../../../test/fake-supabase";
import type { FriendsState } from "@/features/friends/server/friends-state";
import type { RaceToday } from "@/features/race/race-state";
import { useRaceSession } from "@/features/race/hooks/use-race-session";
import { friendsKey, raceTodayKey } from "../query-keys";
import { LiveSyncProvider, useLiveSync } from "./live-sync-provider";

const navigation = vi.hoisted(() => ({ path: "/", replace: vi.fn(), refresh: vi.fn() }));
const socket = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useRouter: () => navigation,
}));
vi.mock("@/lib/supabase/client", () => ({ getSupabaseRealtime: () => socket.current }));

const friends: FriendsState = {
  friends: [{ userId: "friend", name: "친구", username: "friend", tapCount: 5 }],
  incoming: [], outgoing: [], blocked: [],
};
const me = { userId: "me", name: "나", username: "me", tapCount: 10, stage: 0, isMe: true };
const race: RaceToday = {
  date: "2026-09-20", settled: false, me,
  racers: [me, { ...me, userId: "friend", name: "친구", username: "friend", tapCount: 5, isMe: false }],
};
let sdk: ReturnType<typeof fakeSupabase>;
let client: QueryClient;
let requests: string[];

function RaceProbe({ initial = race }: { initial?: RaceToday }) {
  const { data } = useRaceSession(initial);
  return <output data-testid="race">{data.date}:{data.me.tapCount}:{String(data.settled)}:{data.racers[0]?.userId}</output>;
}
function Consumer() {
  const state = useLiveSync();
  return <><output data-testid="friends">{String(state.raceConnected)}:{state.friends.friends[0]?.tapCount}</output>
    <button onClick={() => void state.endSession()}>end session</button></>;
}
function App({ userId = "me", enabled = true, initial = race, strict = false }: {
  userId?: string; enabled?: boolean; initial?: RaceToday; strict?: boolean;
}) {
  const content = <QueryClientProvider client={client}>
    <LiveSyncProvider key={userId} userId={userId} initialFriends={friends} realtimeEnabled={enabled}>
      <Consumer /><Consumer />
      {(navigation.path === "/" || navigation.path === "/ranking") && <RaceProbe initial={initial} />}
    </LiveSyncProvider>
  </QueryClientProvider>;
  return strict ? <StrictMode>{content}</StrictMode> : content;
}
async function tick(ms = 1) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function connect() { await tick(); await act(async () => sdk.ready()); await tick(200); }
const count = (path: string) => requests.filter((request) => request === path).length;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T02:00:00Z"));
  navigation.path = "/";
  navigation.replace.mockClear();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  sdk = fakeSupabase(); socket.current = sdk;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input); requests.push(path);
    const data = path === "/api/friends" ? friends : path === "/api/race/today" ? race : { signals: [] };
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  }));
});
afterEach(async () => {
  cleanup();
  await tick();
  client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
});

it("owns one friends query and preserves the own channel across app routes", async () => {
  const view = render(<App />);
  await tick();
  expect(count("/api/friends")).toBe(0);
  expect(client.getQueryCache().find({ queryKey: friendsKey("me") })?.getObserversCount()).toBe(1);
  await connect();
  for (const path of ["/ranking", "/friends", "/my/collection"]) {
    navigation.path = path; view.rerender(<App />); await tick();
  }
  expect(sdk.joins.get("u:me")).toBe(1);
  expect([...sdk.channels.keys()]).toEqual(["u:me"]);
});

it.each(["/", "/ranking"])("performs at most fifteen GETs over five quiet connected minutes on %s", async (path) => {
  navigation.path = path;
  render(<App />); await connect(); requests = [];
  for (let minute = 0; minute < 5; minute++) await tick(60_000);
  expect(count("/api/race/today")).toBe(5);
  expect(count("/api/friends")).toBe(5);
  expect(count("/api/signals/unread")).toBe(5);
});

it("keeps scheduled corrections running while race events continuously update the cache", async () => {
  render(<App />); await connect(); requests = [];
  for (let second = 0; second < 120; second++) {
    await act(async () => sdk.channels.get("u:friend")?.emit("race", {
      userId: "friend", date: race.date, tapCount: 30 + second, stage: 0,
    }));
    await tick(1_000);
  }
  expect(count("/api/race/today")).toBe(2);
  expect(count("/api/friends")).toBe(2);
  expect(count("/api/signals/unread")).toBe(2);
});

it("continues fallback reads while optimistic taps update the cache", async () => {
  render(<App enabled={false} />); await tick(); requests = [];
  for (let second = 0; second < 6; second++) {
    act(() => client.setQueryData(raceTodayKey("me"), { ...race, me: { ...me, tapCount: 100 + second } }));
    await tick(1_000);
  }
  expect(count("/api/race/today")).toBe(3);
});

it("uses race fallback when only a friend's subscription fails and recovers without duplicating channels", async () => {
  render(<App />); await connect();
  await act(async () => sdk.channels.get("u:friend")?.status?.("CHANNEL_ERROR"));
  requests = []; await tick(6_100);
  expect(count("/api/race/today")).toBe(3);
  expect(count("/api/friends")).toBe(0);
  await connect(); requests = []; await tick(6_100);
  expect(count("/api/race/today")).toBe(0);
  expect(sdk.joins.get("u:me")).toBe(1);
});

it("stops reads in the background and merges visibility, network and socket recovery", async () => {
  render(<App />); await connect();
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  requests = []; await tick(60_000); expect(requests).toEqual([]);
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    sdk.ready();
  });
  await tick(200);
  expect(count("/api/race/today")).toBe(1);
  expect(count("/api/friends")).toBe(1);
  expect(count("/api/signals/unread")).toBe(1);
});

it("still fetches full snapshots on resume when a race event arrives during coalescing", async () => {
  render(<App />); await connect();
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick(10_000); requests = [];
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick(50);
  await act(async () => sdk.channels.get("u:friend")?.emit("race", { userId: "friend", date: race.date, tapCount: 30, stage: 0 }));
  await tick(200);
  expect(count("/api/race/today")).toBe(1);
  expect(count("/api/friends")).toBe(1);
  expect(count("/api/signals/unread")).toBe(1);
});

it("disposes pending signal receipts when the session ends before provider unmount", async () => {
  render(<App />); await connect(); requests = [];
  await act(async () => {
    sdk.channels.get("u:me")?.emit("signal", { id: "signal-one", senderName: "보낸친구", level: "normal", sentAt: new Date().toISOString() });
    screen.getAllByRole("button", { name: "end session" })[0].click();
  });
  await tick(3_500);
  expect(count("/api/signals/read")).toBe(0);
  expect(count("/api/signals/unread")).toBe(0);
});

it("acknowledges one visible signal and deduplicates later delivery after the toast expires", async () => {
  render(<App />); await connect(); requests = [];
  const signal = { id: "signal-one", senderName: "보낸친구", level: "normal", sentAt: new Date().toISOString() };
  await act(async () => sdk.channels.get("u:me")?.emit("signal", signal));
  expect(screen.getAllByText("보낸친구")).toHaveLength(1);
  await tick(4_100);
  expect(screen.queryByText("보낸친구")).toBeNull();
  await act(async () => sdk.channels.get("u:me")?.emit("signal", signal));
  await tick(200);
  expect(screen.queryByText("보낸친구")).toBeNull();
  expect(count("/api/signals/read")).toBe(1);
  expect(count("/api/signals/unread")).toBe(0);
});

it("defers an unread response that arrives in the background until the page is visible", async () => {
  let respond!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (input) => {
    const path = String(input); requests.push(path);
    if (path === "/api/signals/unread") return new Promise<Response>((resolve) => { respond = resolve; });
    return new Response(JSON.stringify(path === "/api/friends" ? friends : race));
  });
  render(<App />); await connect();
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  respond(new Response(JSON.stringify({ signals: [{ id: "hidden-response", senderName: "기다린친구", level: "normal", sentAt: new Date().toISOString() }] })));
  await tick(200);
  expect(screen.queryByText("기다린친구")).toBeNull();
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick(200);
  expect(screen.getAllByText("기다린친구")).toHaveLength(1);
  expect(count("/api/signals/read")).toBe(0);
});

it("patches both cached race and friends from an event without another GET or count regression", async () => {
  render(<App />); await connect(); requests = [];
  await act(async () => sdk.channels.get("u:friend")?.emit("race", { userId: "friend", date: race.date, tapCount: 30, stage: 0 }));
  await tick();
  expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.racers[0]?.tapCount).toBe(30);
  expect(client.getQueryData<FriendsState>(friendsKey("me"))?.friends[0].tapCount).toBe(30);
  await act(async () => sdk.channels.get("u:friend")?.emit("race", { userId: "friend", date: race.date, tapCount: 20, stage: 0 }));
  await tick();
  expect(client.getQueryData<RaceToday>(raceTodayKey("me"))?.racers[0]?.tapCount).toBe(30);
  expect(requests).toEqual([]);
});

it("survives StrictMode cleanup and isolates the next user's cached data", async () => {
  const view = render(<App strict />); await connect();
  expect([...sdk.channels.keys()].sort()).toEqual(["u:friend", "u:me"]);
  const second = { ...race, me: { ...me, userId: "second", tapCount: 0 }, racers: [{ ...me, userId: "second", tapCount: 0 }] };
  view.rerender(<App strict userId="second" initial={second} />); await tick(200);
  expect(sdk.channels.has("u:me")).toBe(false);
  expect(client.getQueryData(raceTodayKey("me"))).toBeUndefined();
  expect(screen.getByTestId("race").textContent).toContain(":0:");
});

it("applies settlement immediately and never restores a previous day's optimistic count", async () => {
  const view = render(<App enabled={false} />); await tick();
  act(() => client.setQueryData(raceTodayKey("me"), { ...race, me: { ...me, tapCount: 120 } }));
  view.rerender(<App enabled={false} initial={{ ...race, settled: true }} />);
  expect(screen.getByTestId("race").textContent).toContain(":true:");
  const nextDay = { ...race, date: "2026-09-21", me: { ...me, tapCount: 0 } };
  view.rerender(<App enabled={false} initial={nextDay} />); await tick();
  expect(screen.getByTestId("race").textContent).toContain("2026-09-21:0:false");
});

it.each(["/friends", "/records", "/my/collection"])("does not query the full race on %s", async (path) => {
  navigation.path = path;
  render(<App />); await connect(); requests = [];
  for (let minute = 0; minute < 5; minute++) await tick(60_000);
  expect(count("/api/race/today")).toBe(0);
  expect(count("/api/friends")).toBe(5);
  expect(count("/api/signals/unread")).toBe(5);
});

it("stops reads when offline and performs one correction on return", async () => {
  render(<App />); await connect();
  await act(async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
  });
  requests = []; await tick(65_000); expect(requests).toEqual([]);
  await act(async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
  });
  await tick(200);
  expect(count("/api/race/today")).toBe(1);
  expect(count("/api/friends")).toBe(1);
  expect(count("/api/signals/unread")).toBe(1);
});

it("reconciles a visible KST midnight without carrying yesterday's taps", async () => {
  vi.setSystemTime(new Date("2026-09-20T14:59:50Z"));
  render(<App />); await connect();
  vi.mocked(fetch).mockImplementation(async (input) => {
    const path = String(input); requests.push(path);
    const next = { ...race, date: "2026-09-21", me: { ...me, tapCount: 0 }, racers: [{ ...me, tapCount: 0 }] };
    return new Response(JSON.stringify(path === "/api/race/today" ? next : path === "/api/friends" ? friends : { signals: [] }));
  });
  requests = []; await tick(10_000);
  expect(count("/api/race/today")).toBe(1);
  expect(screen.getByTestId("race").textContent).toContain("2026-09-21:0:");
});

it("ends the session on unauthorized queries without retrying", async () => {
  vi.mocked(fetch).mockImplementation(async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ error: "로그인이 필요해요" }), { status: 401 });
  });
  render(<App />); await tick(500);
  expect(navigation.replace).toHaveBeenCalledWith("/login");
  const before = requests.length;
  await tick(60_000);
  expect(requests).toHaveLength(before);
  expect(sdk.channels.size).toBe(0);
});

it("clears user caches and completes session exit even if channel removal fails", async () => {
  render(<App />); await connect();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(sdk, "removeChannel").mockRejectedValueOnce(new Error("temporary removal failure"));
  await act(async () => screen.getAllByRole("button", { name: "end session" })[0].click());
  await tick(200);
  expect(client.getQueryData(raceTodayKey("me"))).toBeUndefined();
  expect(client.getQueryData(friendsKey("me"))).toBeUndefined();
  requests = []; await tick(60_000);
  expect(requests).toEqual([]);
});
