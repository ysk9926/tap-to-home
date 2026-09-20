import type { QueryClient } from "@tanstack/react-query";
import type { FriendsState } from "@/features/friends/server/friends-state";
import { withRacerCount, type RaceToday } from "@/features/race/race-state";
import { todayKst } from "@/lib/kst";
import type { RacePayload } from "./channels";
import { friendsKey, raceTodayKey } from "./query-keys";

export function applyRaceEvent(client: QueryClient, userId: string, payload: RacePayload) {
  if (payload.date !== todayKst() || payload.userId === userId || !Number.isInteger(payload.tapCount) || payload.tapCount < 0) return;
  client.setQueryData<RaceToday>(raceTodayKey(userId), (current) => {
    if (!current || current.date !== payload.date) return current;
    const racer = current.racers.find((entry) => entry.userId === payload.userId);
    return racer && racer.tapCount < payload.tapCount ? withRacerCount(current, payload.userId, payload.tapCount) : current;
  });
  client.setQueryData<FriendsState>(friendsKey(userId), (current) => {
    if (!current || !current.friends.some((friend) => friend.userId === payload.userId && friend.tapCount < payload.tapCount)) return current;
    return {
      ...current,
      friends: current.friends.map((friend) => friend.userId === payload.userId
        ? { ...friend, tapCount: Math.max(friend.tapCount, payload.tapCount) } : friend),
    };
  });
}
