"use client";

import { useLiveSync } from "@/features/realtime/live-sync-context";
import { getQueryPolicy } from "@/features/realtime/sync-policy";
import type { RaceToday } from "../race-state";
import { useRaceToday } from "./use-race-today";

export function useRaceSession(initial: RaceToday) {
  const { userId, raceConnected, visible, online, active } = useLiveSync();
  const { data } = useRaceToday(userId, initial, getQueryPolicy({
    domain: "race", connected: raceConnected, visible, online, active,
  }));
  return { data, connected: raceConnected };
}
