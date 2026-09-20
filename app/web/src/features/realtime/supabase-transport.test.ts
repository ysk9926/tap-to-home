import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseRealtime: () => sdk.current,
}));

type RemoveResult = "ok" | "timed out" | "error" | Error;

class FakeSdkChannel {
  isOpen = false;
  joinedOnce = false;
  subscribeAttempts = 0;
  readonly statusCallbacks: Array<(status: string) => void> = [];

  constructor(readonly topic: string) {}

  on(): FakeSdkChannel {
    return this;
  }

  subscribe(callback: (status: string) => void): void {
    this.subscribeAttempts += 1;
    if (this.joinedOnce) return;
    this.joinedOnce = true;
    this.isOpen = true;
    this.statusCallbacks.push(callback);
  }
}

class FakeSdkClient {
  readonly channels = new Map<string, FakeSdkChannel>();
  readonly channelCalls: string[] = [];
  readonly removeCalls: FakeSdkChannel[] = [];
  readonly operations: string[] = [];
  readonly removeResults: RemoveResult[] = [];

  channel(topic: string): FakeSdkChannel {
    this.channelCalls.push(topic);
    this.operations.push(`channel:${topic}`);
    const existing = this.channels.get(topic);
    if (existing) return existing;
    const channel = new FakeSdkChannel(topic);
    this.channels.set(topic, channel);
    return channel;
  }

  async removeChannel(channel: FakeSdkChannel): Promise<"ok" | "timed out" | "error"> {
    this.removeCalls.push(channel);
    const result = this.removeResults.shift() ?? "ok";
    this.operations.push(`remove:${channel.topic}:${result instanceof Error ? "reject" : result}`);
    if (result instanceof Error) throw result;
    if (result === "ok") {
      channel.isOpen = false;
      if (this.channels.get(channel.topic) === channel) this.channels.delete(channel.topic);
    }
    return result;
  }
}

beforeEach(() => {
  vi.resetModules();
  sdk.current = new FakeSdkClient();
});

describe("Supabase realtime transport lifecycle", () => {
  it.each([
    ["a non-ok SDK status", "error" as const, "Supabase realtime removal returned error"],
    ["a rejected SDK promise", new Error("socket failed"), "socket failed"],
  ])("retains the exact SDK channel after %s and retries it", async (_case, failure, message) => {
    const client = sdk.current as FakeSdkClient;
    client.removeResults.push(failure, "ok");
    const { createSupabaseTransport } = await import("./supabase-transport");
    const transport = createSupabaseTransport();
    const wrapped = transport.channel("u:me");
    wrapped.subscribe(() => undefined);
    const actual = client.channels.get("u:me");

    await expect(transport.removeChannel(wrapped)).rejects.toThrow(message);
    expect(actual?.isOpen).toBe(true);

    await expect(transport.removeChannel(wrapped)).resolves.toBeUndefined();
    expect(client.removeCalls).toEqual([actual, actual]);
    expect(actual?.isOpen).toBe(false);
  });

  it("retries a failed old-provider removal before a new provider subscribes to the cached topic", async () => {
    const client = sdk.current as FakeSdkClient;
    client.removeResults.push("error", "ok");
    const { createSupabaseTransport, queueRealtimeLifecycle } = await import("./supabase-transport");
    const oldTransport = createSupabaseTransport();
    const oldWrapped = oldTransport.channel("u:me");
    oldWrapped.subscribe(() => undefined);
    const actual = client.channels.get("u:me");

    await expect(queueRealtimeLifecycle(() => oldTransport.removeChannel(oldWrapped))).rejects.toThrow(
      "Supabase realtime removal returned error",
    );

    const newTransport = createSupabaseTransport();
    await queueRealtimeLifecycle(async () => {
      const next = newTransport.channel("u:me");
      next.subscribe(() => undefined);
    });

    const replacement = client.channels.get("u:me");
    expect(client.removeCalls).toEqual([actual, actual]);
    expect(replacement).not.toBe(actual);
    expect(actual?.subscribeAttempts).toBe(1);
    expect(actual?.statusCallbacks).toHaveLength(1);
    expect(replacement?.subscribeAttempts).toBe(1);
    expect(replacement?.statusCallbacks).toHaveLength(1);
    expect(client.operations).toEqual([
      "channel:u:me",
      "remove:u:me:error",
      "remove:u:me:ok",
      "channel:u:me",
    ]);
  });

  it("blocks stale same-topic reuse through persistent failures and recovers on the next lifecycle operation", async () => {
    const client = sdk.current as FakeSdkClient;
    client.removeResults.push("error", "timed out", "ok");
    const { createSupabaseTransport, queueRealtimeLifecycle } = await import("./supabase-transport");
    const oldTransport = createSupabaseTransport();
    const oldWrapped = oldTransport.channel("u:me");
    oldWrapped.subscribe(() => undefined);
    const actual = client.channels.get("u:me");
    await expect(queueRealtimeLifecycle(() => oldTransport.removeChannel(oldWrapped))).rejects.toThrow();
    const newTransport = createSupabaseTransport();

    await expect(
      queueRealtimeLifecycle(async () => {
        newTransport.channel("u:me").subscribe(() => undefined);
      }),
    ).rejects.toThrow("pending removal");
    expect(client.channelCalls).toEqual(["u:me"]);
    expect(actual?.subscribeAttempts).toBe(1);

    await expect(
      queueRealtimeLifecycle(async () => {
        newTransport.channel("u:me").subscribe(() => undefined);
      }),
    ).resolves.toBeUndefined();
    const replacement = client.channels.get("u:me");
    expect(client.removeCalls).toEqual([actual, actual, actual]);
    expect(replacement).not.toBe(actual);
    expect(actual?.subscribeAttempts).toBe(1);
    expect(actual?.statusCallbacks).toHaveLength(1);
    expect(replacement?.subscribeAttempts).toBe(1);
    expect(replacement?.statusCallbacks).toHaveLength(1);
  });

  it("allows a different healthy topic while failed cleanup remains pending", async () => {
    const client = sdk.current as FakeSdkClient;
    client.removeResults.push("error", "error");
    const { createSupabaseTransport, queueRealtimeLifecycle } = await import("./supabase-transport");
    const oldTransport = createSupabaseTransport();
    const oldWrapped = oldTransport.channel("u:stale");
    oldWrapped.subscribe(() => undefined);
    await expect(queueRealtimeLifecycle(() => oldTransport.removeChannel(oldWrapped))).rejects.toThrow();
    const newTransport = createSupabaseTransport();

    await expect(
      queueRealtimeLifecycle(async () => {
        newTransport.channel("u:healthy").subscribe(() => undefined);
      }),
    ).resolves.toBeUndefined();

    expect(client.channels.get("u:stale")?.isOpen).toBe(true);
    expect(client.channels.get("u:healthy")?.isOpen).toBe(true);
  });
});
