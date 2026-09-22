import { userChannel, type FriendPayload, type RacePayload, type SignalPayload } from "./channels";

export type SyncSnapshot = { ownConnected: boolean; raceConnected: boolean };
export type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
export type SyncChannel = {
  on(event: "race" | "signal" | "friend", callback: (payload: unknown) => void): SyncChannel;
  subscribe(callback: (status: ChannelStatus) => void): void;
};
export type SyncTransport = {
  channel(topic: string): SyncChannel;
  removeChannel(channel: SyncChannel): Promise<void>;
};
export type RealtimeSession = {
  start(): Promise<void>;
  restart(): Promise<void>;
  stop(): Promise<void>;
  setFriendIds(ids: readonly string[]): Promise<void>;
  getSnapshot(): SyncSnapshot;
  subscribe(listener: () => void): () => void;
};
export type SessionOptions = {
  userId: string;
  transport: SyncTransport;
  onRace: (payload: RacePayload) => void;
  onSignal: (payload: SignalPayload) => void;
  onFriend: (payload: FriendPayload) => void;
};
export type CreateRealtimeSession = (options: SessionOptions) => RealtimeSession;

type ChannelRecord = {
  channel: SyncChannel;
  active: boolean;
  connected: boolean;
};

export const createRealtimeSession: CreateRealtimeSession = ({
  userId,
  transport,
  onRace,
  onSignal,
  onFriend,
}) => {
  let running = false;
  let desiredFriendIds = new Set<string>();
  let ownChannel: ChannelRecord | undefined;
  const friendChannels = new Map<string, ChannelRecord>();
  const pendingRemovals = new Set<ChannelRecord>();
  const listeners = new Set<() => void>();
  let snapshot: SyncSnapshot = { ownConnected: false, raceConnected: false };
  let operationQueue = Promise.resolve();

  const updateSnapshot = () => {
    const ownConnected = Boolean(running && ownChannel?.connected);
    const raceConnected =
      ownConnected &&
      [...desiredFriendIds].every((friendId) => {
        const record = friendChannels.get(friendId);
        return Boolean(record?.active && record.connected);
      });

    if (snapshot.ownConnected === ownConnected && snapshot.raceConnected === raceConnected) return;

    snapshot = { ownConnected, raceConnected };
    for (const listener of [...listeners]) listener();
  };

  const retryPendingRemovals = async () => {
    const recordsByChannel = new Map<SyncChannel, ChannelRecord[]>();
    for (const record of pendingRemovals) {
      const records = recordsByChannel.get(record.channel) ?? [];
      records.push(record);
      recordsByChannel.set(record.channel, records);
    }

    const attempts = await Promise.allSettled(
      [...recordsByChannel].map(async ([channel, records]) => {
        await transport.removeChannel(channel);
        for (const record of records) pendingRemovals.delete(record);
      }),
    );
    const errors = attempts
      .filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected")
      .map((attempt) => attempt.reason);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Failed to remove realtime channels");
  };

  const removeRecords = async (records: readonly ChannelRecord[]) => {
    for (const record of records) {
      record.active = false;
      pendingRemovals.add(record);
    }
    await retryPendingRemovals();
  };

  const createOwnChannel = () => {
    const channel = transport.channel(userChannel(userId));
    const record: ChannelRecord = { channel, active: true, connected: false };
    ownChannel = record;

    channel.on("friend", (payload) => {
      if (running && record.active && ownChannel === record) onFriend(payload as FriendPayload);
    });
    channel.on("signal", (payload) => {
      if (running && record.active && ownChannel === record) onSignal(payload as SignalPayload);
    });
    channel.on("race", (payload) => {
      if (running && record.active && ownChannel === record) onRace(payload as RacePayload);
    });
    channel.subscribe((status) => {
      if (!running || !record.active || ownChannel !== record) return;
      record.connected = status === "SUBSCRIBED";
      updateSnapshot();
    });
  };

  const createFriendChannel = (friendId: string) => {
    const channel = transport.channel(userChannel(friendId));
    const record: ChannelRecord = { channel, active: true, connected: false };
    friendChannels.set(friendId, record);

    channel.on("race", (payload) => {
      if (running && record.active && friendChannels.get(friendId) === record) {
        onRace(payload as RacePayload);
      }
    });
    channel.subscribe((status) => {
      if (!running || !record.active || friendChannels.get(friendId) !== record) return;
      record.connected = status === "SUBSCRIBED";
      updateSnapshot();
    });
  };

  const stopCurrentChannels = async () => {
    running = false;
    const records = [...friendChannels.values()];
    if (ownChannel) records.push(ownChannel);
    ownChannel = undefined;
    friendChannels.clear();
    updateSnapshot();
    await removeRecords(records);
  };

  const startCurrentChannels = async () => {
    await retryPendingRemovals();
    running = true;

    try {
      createOwnChannel();
      for (const friendId of [...desiredFriendIds].sort()) createFriendChannel(friendId);
      updateSnapshot();
    } catch (error) {
      try {
        await stopCurrentChannels();
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Failed to start realtime session");
      }
      throw error;
    }
  };

  const enqueue = (operation: () => Promise<void> | void): Promise<void> => {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.catch(() => undefined);
    return result;
  };

  return {
    start() {
      return enqueue(async () => {
        if (running) return;
        await startCurrentChannels();
      });
    },
    restart() {
      return enqueue(async () => {
        if (running || ownChannel || friendChannels.size > 0) await stopCurrentChannels();
        await startCurrentChannels();
      });
    },
    stop() {
      return enqueue(async () => {
        if (!running && !ownChannel && friendChannels.size === 0 && pendingRemovals.size === 0) return;
        await stopCurrentChannels();
      });
    },
    setFriendIds(ids) {
      return enqueue(async () => {
        desiredFriendIds = new Set(ids.filter((id) => id !== userId));
        updateSnapshot();
        if (!running) return;

        const removed: ChannelRecord[] = [];
        for (const [friendId, record] of friendChannels) {
          if (desiredFriendIds.has(friendId)) continue;
          record.active = false;
          friendChannels.delete(friendId);
          removed.push(record);
        }
        updateSnapshot();
        await removeRecords(removed);

        for (const friendId of [...desiredFriendIds].sort()) {
          if (friendChannels.has(friendId)) continue;
          try {
            createFriendChannel(friendId);
          } catch (error) {
            const record = friendChannels.get(friendId);
            if (record) {
              friendChannels.delete(friendId);
              updateSnapshot();
              try {
                await removeRecords([record]);
              } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], "Failed to add realtime friend channel");
              }
            }
            updateSnapshot();
            throw error;
          }
        }
        updateSnapshot();
      });
    },
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
