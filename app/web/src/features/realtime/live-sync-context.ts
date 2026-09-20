"use client";

import { createContext, useContext } from "react";
import type { FriendsState } from "@/features/friends/server/friends-state";

export type LiveSyncValue = {
  userId: string;
  friends: FriendsState;
  ownConnected: boolean;
  raceConnected: boolean;
  visible: boolean;
  online: boolean;
  active: boolean;
  endSession: () => Promise<void>;
};

export const LiveSyncContext = createContext<LiveSyncValue | null>(null);
export function useLiveSync(): LiveSyncValue {
  const value = useContext(LiveSyncContext);
  if (!value) throw new Error("LiveSyncProvider is required");
  return value;
}
