import { ApiError } from "@/lib/fetch-json";

export type SyncDomain = "race" | "friends" | "signals";
export type QueryPolicy = { enabled: boolean; staleTime: number; refetchInterval: number | false };
export type PolicyInput = {
  domain: SyncDomain;
  connected: boolean;
  visible: boolean;
  online: boolean;
  active: boolean;
};

export function getQueryPolicy(input: PolicyInput): QueryPolicy {
  const enabled = input.active && input.visible && input.online;
  const fallback = { race: 2_000, friends: 20_000, signals: 5_000 };
  return {
    enabled,
    staleTime: input.domain === "race" ? 30_000 : 60_000,
    refetchInterval: enabled ? (input.connected ? 60_000 : fallback[input.domain]) : false,
  };
}

export function retrySyncQuery(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}
