import { describe, expect, it, vi } from "vitest";
import { userChannel } from "./channels";
import {
  createRealtimeSession,
  type ChannelStatus,
  type SyncChannel,
  type SyncTransport,
} from "./session-controller";

type EventName = "race" | "signal" | "friend";

class FakeChannel implements SyncChannel {
  readonly eventCallbacks = new Map<EventName, Array<(payload: unknown) => void>>();
  readonly statusCallbacks: Array<(status: ChannelStatus) => void> = [];
  subscribeCalls = 0;
  isOpen = false;

  constructor(
    readonly topic: string,
    private readonly operations: string[],
    private readonly getImmediateStatus: () => ChannelStatus | undefined,
  ) {}

  on(event: EventName, callback: (payload: unknown) => void): SyncChannel {
    this.operations.push(`${this.topic}:on:${event}`);
    const callbacks = this.eventCallbacks.get(event) ?? [];
    callbacks.push(callback);
    this.eventCallbacks.set(event, callbacks);
    return this;
  }

  subscribe(callback: (status: ChannelStatus) => void): void {
    this.operations.push(`${this.topic}:subscribe`);
    this.subscribeCalls += 1;
    if (this.isOpen) return;
    this.isOpen = true;
    this.statusCallbacks.push(callback);
    const immediateStatus = this.getImmediateStatus();
    if (immediateStatus) callback(immediateStatus);
  }

  markRemoved(): void {
    this.isOpen = false;
  }

  emitStatus(status: ChannelStatus): void {
    for (const callback of [...this.statusCallbacks]) callback(status);
  }

  emit(event: EventName, payload: unknown): void {
    for (const callback of [...(this.eventCallbacks.get(event) ?? [])]) callback(payload);
  }
}

class FakeTransport implements SyncTransport {
  readonly channels = new Map<string, FakeChannel>();
  readonly activeChannels = new Set<FakeChannel>();
  readonly channelCalls: string[] = [];
  readonly removeCalls: FakeChannel[] = [];
  readonly operations: string[] = [];
  readonly removeResults: Array<Promise<void>> = [];
  readonly channelFailures = new Map<string, Error[]>();
  readonly immediateStatuses = new Map<string, ChannelStatus>();

  channel(topic: string): FakeChannel {
    this.channelCalls.push(topic);
    this.operations.push(`${topic}:channel`);
    const failures = this.channelFailures.get(topic);
    const failure = failures?.shift();
    if (failure) throw failure;
    const existing = this.channels.get(topic);
    if (existing) {
      this.activeChannels.add(existing);
      return existing;
    }

    const channel = new FakeChannel(topic, this.operations, () => this.immediateStatuses.get(topic));
    this.channels.set(topic, channel);
    this.activeChannels.add(channel);
    return channel;
  }

  async removeChannel(channel: SyncChannel): Promise<void> {
    const fakeChannel = channel as FakeChannel;
    this.removeCalls.push(fakeChannel);
    this.operations.push(`${fakeChannel.topic}:remove`);
    await (this.removeResults.shift() ?? Promise.resolve());
    fakeChannel.markRemoved();
    this.activeChannels.delete(fakeChannel);
  }

  failNextChannel(topic: string, error: Error): void {
    const failures = this.channelFailures.get(topic) ?? [];
    failures.push(error);
    this.channelFailures.set(topic, failures);
  }

  subscribeImmediately(topic: string, status: ChannelStatus): void {
    this.immediateStatuses.set(topic, status);
  }

  get(topic: string): FakeChannel {
    const channel = this.channels.get(topic);
    if (!channel) throw new Error(`Missing fake channel: ${topic}`);
    return channel;
  }
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function setup() {
  const transport = new FakeTransport();
  const onRace = vi.fn();
  const onSignal = vi.fn();
  const onFriend = vi.fn();
  const session = createRealtimeSession({
    userId: "me",
    transport,
    onRace,
    onSignal,
    onFriend,
  });

  return { session, transport, onRace, onSignal, onFriend };
}

describe("createRealtimeSession", () => {
  it("creates and subscribes to the own topic only once across repeated starts", async () => {
    const { session, transport } = setup();

    expect(transport.channelCalls).toEqual([]);

    await session.start();
    await session.start();

    expect(transport.channelCalls).toEqual([userChannel("me")]);
    expect(transport.get(userChannel("me")).subscribeCalls).toBe(1);
  });

  it("registers all own-topic handlers before subscribing and routes current payloads", async () => {
    const { session, transport, onRace, onSignal, onFriend } = setup();
    const race = { userId: "me", date: "2026-09-20", tapCount: 12, stage: 2 };
    const signal = { id: "s1", senderName: "친구", level: "light" as const, sentAt: "now" };
    const friend = { kind: "accepted" as const, actorName: "친구" };

    await session.start();

    expect(transport.operations).toEqual([
      "u:me:channel",
      "u:me:on:friend",
      "u:me:on:signal",
      "u:me:on:race",
      "u:me:subscribe",
    ]);

    const mine = transport.get("u:me");
    mine.emit("race", race);
    mine.emit("signal", signal);
    mine.emit("friend", friend);

    expect(onRace).toHaveBeenCalledWith(race);
    expect(onSignal).toHaveBeenCalledWith(signal);
    expect(onFriend).toHaveBeenCalledWith(friend);
  });

  it("derives own and race connectivity from current channel statuses", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["friend-b", "friend-a"]);
    await session.start();

    transport.get("u:me").emitStatus("SUBSCRIBED");
    transport.get("u:friend-a").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: false });

    transport.get("u:friend-b").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });

    transport.get("u:friend-a").emitStatus("CHANNEL_ERROR");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: false });
  });

  it("treats the race as connected when the own channel is ready and there are no friends", async () => {
    const { session, transport } = setup();
    await session.start();

    transport.get("u:me").emitStatus("SUBSCRIBED");

    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });
  });

  it("treats the race as disconnected when friends are ready but the own channel fails", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["friend-a"]);
    await session.start();
    transport.get("u:friend-a").emitStatus("SUBSCRIBED");

    expect(session.getSnapshot()).toEqual({ ownConnected: false, raceConnected: false });

    transport.get("u:me").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });

    transport.get("u:me").emitStatus("TIMED_OUT");
    expect(session.getSnapshot()).toEqual({ ownConnected: false, raceConnected: false });
  });

  it("degrades race health when a desired friend channel cannot be allocated", async () => {
    const { session, transport } = setup();
    await session.start();
    transport.get("u:me").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });
    transport.failNextChannel("u:new-friend", new Error("channel allocation failed"));

    await expect(session.setFriendIds(["new-friend"])).rejects.toThrow("channel allocation failed");

    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: false });
  });

  it("degrades before awaiting removal while replacing a friend", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["old-friend"]);
    await session.start();
    transport.get("u:me").emitStatus("SUBSCRIBED");
    transport.get("u:old-friend").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });
    const removal = deferred();
    transport.removeResults.push(removal.promise);

    const replacing = session.setFriendIds(["new-friend"]);
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.channels.has("u:new-friend")).toBe(false);
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: false });

    removal.resolve();
    await replacing;
  });

  it("stays degraded while synchronous subscriptions allocate several desired friends", async () => {
    const { session, transport } = setup();
    transport.subscribeImmediately("u:me", "SUBSCRIBED");
    transport.subscribeImmediately("u:friend-a", "SUBSCRIBED");
    transport.subscribeImmediately("u:friend-b", "SUBSCRIBED");
    await session.setFriendIds(["friend-a", "friend-b"]);
    const snapshots: Array<{ ownConnected: boolean; raceConnected: boolean }> = [];
    session.subscribe(() => snapshots.push(session.getSnapshot()));

    await session.start();

    expect(snapshots).toEqual([
      { ownConnected: true, raceConnected: false },
      { ownConnected: true, raceConnected: true },
    ]);
  });

  it("does not recreate channels when only friend order or duplicates change", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["friend-a", "friend-b"]);
    await session.start();
    const callsBefore = transport.channelCalls.length;
    const removesBefore = transport.removeCalls.length;

    await session.setFriendIds(["friend-b", "friend-a", "friend-b"]);

    expect(transport.channelCalls).toHaveLength(callsBefore);
    expect(transport.removeCalls).toHaveLength(removesBefore);
    expect(transport.get("u:friend-a").subscribeCalls).toBe(1);
    expect(transport.get("u:friend-b").subscribeCalls).toBe(1);
  });

  it("changes only added and removed friend channels", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["friend-a", "friend-b"]);
    await session.start();
    const own = transport.get("u:me");
    const friendA = transport.get("u:friend-a");

    await session.setFriendIds(["friend-b", "friend-c"]);

    expect(transport.removeCalls).toEqual([friendA]);
    expect(transport.removeCalls).not.toContain(own);
    expect(transport.channelCalls).toEqual(["u:me", "u:friend-a", "u:friend-b", "u:friend-c"]);
    expect(transport.get("u:friend-b").subscribeCalls).toBe(1);
    expect(transport.get("u:friend-c").subscribeCalls).toBe(1);
  });

  it("waits for asynchronous stop removal before restarting a reused topic", async () => {
    const { session, transport } = setup();
    await session.start();
    const removal = deferred();
    transport.removeResults.push(removal.promise);

    const stopping = session.stop();
    const restarting = session.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.removeCalls).toHaveLength(1);
    expect(transport.channelCalls).toEqual(["u:me"]);

    removal.resolve();
    await stopping;
    await restarting;

    expect(transport.channelCalls).toEqual(["u:me", "u:me"]);
    expect(transport.get("u:me").subscribeCalls).toBe(2);
  });

  it("serializes friend removal and re-addition of the same cached channel", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["friend-a"]);
    await session.start();
    const removal = deferred();
    transport.removeResults.push(removal.promise);

    const removing = session.setFriendIds([]);
    const readding = session.setFriendIds(["friend-a"]);
    await Promise.resolve();
    await Promise.resolve();

    expect(transport.channelCalls.filter((topic) => topic === "u:friend-a")).toHaveLength(1);

    removal.resolve();
    await removing;
    await readding;

    expect(transport.channelCalls.filter((topic) => topic === "u:friend-a")).toHaveLength(2);
    expect(transport.get("u:friend-a").subscribeCalls).toBe(2);
  });

  it("ignores stale statuses and event handlers after a same-topic restart", async () => {
    const { session, transport, onRace } = setup();
    await session.start();
    const mine = transport.get("u:me");
    const staleStatus = mine.statusCallbacks[0];
    const staleRace = mine.eventCallbacks.get("race")?.[0];

    await session.stop();
    await session.start();
    const currentStatus = mine.statusCallbacks[1];
    const currentRace = mine.eventCallbacks.get("race")?.[1];
    currentStatus?.("SUBSCRIBED");
    const connectedSnapshot = session.getSnapshot();

    staleStatus?.("CLOSED");
    staleRace?.({ userId: "me", date: "old", tapCount: 1, stage: 1 });

    expect(session.getSnapshot()).toBe(connectedSnapshot);
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });
    expect(onRace).not.toHaveBeenCalled();

    const currentPayload = { userId: "me", date: "new", tapCount: 2, stage: 1 };
    currentRace?.(currentPayload);
    expect(onRace).toHaveBeenCalledOnce();
    expect(onRace).toHaveBeenCalledWith(currentPayload);
  });

  it("keeps snapshot identity stable and notifies only when values change", async () => {
    const { session, transport } = setup();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const initial = session.getSnapshot();
    await session.start();

    expect(session.getSnapshot()).toBe(initial);
    transport.get("u:me").emitStatus("CHANNEL_ERROR");
    expect(session.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();

    transport.get("u:me").emitStatus("SUBSCRIBED");
    const connected = session.getSnapshot();
    expect(connected).not.toBe(initial);
    expect(listener).toHaveBeenCalledOnce();

    transport.get("u:me").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toBe(connected);
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
    transport.get("u:me").emitStatus("CLOSED");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("repeated stop leaves no active channels and can no longer notify an unsubscribed listener", async () => {
    const { session, transport } = setup();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    await session.setFriendIds(["friend-a", "friend-b"]);
    await session.start();
    transport.get("u:me").emitStatus("SUBSCRIBED");
    unsubscribe();

    await session.stop();
    await session.stop();

    expect(transport.activeChannels.size).toBe(0);
    expect(transport.removeCalls).toHaveLength(3);
    expect(session.getSnapshot()).toEqual({ ownConnected: false, raceConnected: false });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("rejects a failed stop and retries cleanup before a queued same-topic restart", async () => {
    const { session, transport } = setup();
    await session.start();
    const removal = deferred();
    transport.removeResults.push(removal.promise);

    const stopping = session.stop();
    const restarting = session.start();
    await Promise.resolve();
    removal.reject(new Error("remove failed"));

    await expect(stopping).rejects.toThrow("remove failed");
    await expect(restarting).resolves.toBeUndefined();
    expect(transport.channelCalls).toEqual(["u:me", "u:me"]);
    expect(transport.removeCalls).toHaveLength(2);
    expect(transport.get("u:me").subscribeCalls).toBe(2);
    expect(transport.get("u:me").statusCallbacks).toHaveLength(2);

    transport.get("u:me").emitStatus("SUBSCRIBED");
    expect(session.getSnapshot()).toEqual({ ownConnected: true, raceConnected: true });
  });

  it("retries a failed removal on a subsequent stop", async () => {
    const { session, transport } = setup();
    await session.start();
    const removal = deferred();
    transport.removeResults.push(removal.promise);
    const firstStop = session.stop();
    await Promise.resolve();
    removal.reject(new Error("remove failed"));

    await expect(firstStop).rejects.toThrow("remove failed");
    expect(transport.get("u:me").isOpen).toBe(true);

    await expect(session.stop()).resolves.toBeUndefined();
    expect(transport.removeCalls).toHaveLength(2);
    expect(transport.get("u:me").isOpen).toBe(false);
  });

  it("deduplicates friend ids and never subscribes to the own topic as a friend", async () => {
    const { session, transport } = setup();
    await session.setFriendIds(["me", "friend-a", "friend-a"]);
    await session.start();

    expect(transport.channelCalls).toEqual(["u:me", "u:friend-a"]);
    expect(transport.get("u:me").subscribeCalls).toBe(1);
    expect(transport.get("u:friend-a").subscribeCalls).toBe(1);
  });
});
