import type { QueryClient } from "@tanstack/react-query";

export const raceTodayKey = (userId: string) => ["race", "today", userId] as const;
export const friendsKey = (userId: string) => ["friends", userId] as const;
export const signalsUnreadKey = (userId: string) => ["signals", "unread", userId] as const;
export const userSyncKeys = (userId: string) => [raceTodayKey(userId), friendsKey(userId), signalsUnreadKey(userId)];

const owners = new WeakMap<QueryClient, Map<string, number>>();

/** StrictMode 재설정과 같은 사용자 Provider 교체는 캐시를 유지한다. */
export function retainUserSyncQueries(client: QueryClient, userId: string): () => void {
  let users = owners.get(client);
  if (!users) { users = new Map(); owners.set(client, users); }
  const activeUsers = users;
  activeUsers.set(userId, (activeUsers.get(userId) ?? 0) + 1);
  return () => {
    activeUsers.set(userId, (activeUsers.get(userId) ?? 1) - 1);
    queueMicrotask(() => {
      if (activeUsers.get(userId) !== 0) return;
      activeUsers.delete(userId);
      void clearUserSyncQueries(client, userId);
    });
  };
}

export async function clearUserSyncQueries(client: QueryClient, userId: string): Promise<void> {
  await Promise.all(userSyncKeys(userId).map((queryKey) => client.cancelQueries({ queryKey, exact: true })));
  userSyncKeys(userId).forEach((queryKey) => client.removeQueries({ queryKey, exact: true }));
}
