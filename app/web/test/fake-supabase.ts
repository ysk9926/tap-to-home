type Status = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

/** SDK처럼 같은 topic은 같은 객체, 두 번째 subscribe는 상태 콜백을 추가하지 않는다. */
export function fakeSupabase() {
  const channels = new Map<string, FakeChannel>();
  const joins = new Map<string, number>();
  const removed: string[] = [];

  class FakeChannel {
    listeners = new Map<string, ((message: { payload: unknown }) => void)[]>();
    status?: (status: Status) => void;
    constructor(readonly topic: string) {}
    on(_type: string, filter: { event: string }, callback: (message: { payload: unknown }) => void) {
      this.listeners.set(filter.event, [...(this.listeners.get(filter.event) ?? []), callback]);
      return this;
    }
    subscribe(callback: (status: Status) => void) {
      if (!this.status) {
        this.status = callback;
        joins.set(this.topic, (joins.get(this.topic) ?? 0) + 1);
      }
      return this;
    }
    emit(event: string, payload: unknown) {
      this.listeners.get(event)?.forEach((callback) => callback({ payload }));
    }
  }

  return {
    channels,
    joins,
    removed,
    channel(topic: string) {
      let channel = channels.get(topic);
      if (!channel) { channel = new FakeChannel(topic); channels.set(topic, channel); }
      return channel;
    },
    async removeChannel(channel: FakeChannel) {
      await Promise.resolve();
      channel.status?.("CLOSED");
      if (channels.get(channel.topic) === channel) channels.delete(channel.topic);
      removed.push(channel.topic);
      return "ok";
    },
    ready() { channels.forEach((channel) => channel.status?.("SUBSCRIBED")); },
  };
}
