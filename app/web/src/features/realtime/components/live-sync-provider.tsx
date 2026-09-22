"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useFriends, type FriendsState } from "@/features/friends/hooks/use-friends";
import { useSignalToasts } from "@/features/signal/hooks/use-signal-toasts";
import { SignalToastLayer } from "@/features/signal/components/signal-toast-layer";
import { ApiError } from "@/lib/fetch-json";
import { subscribeSessionExpired } from "@/lib/auth/session-events";
import { useBrowserActivity } from "../browser-activity";
import { applyRaceEvent } from "../cache-updates";
import { LiveSyncContext } from "../live-sync-context";
import { clearUserSyncQueries, friendsKey, raceTodayKey, userSyncKeys, retainUserSyncQueries } from "../query-keys";
import { createRealtimeSession } from "../session-controller";
import { createSupabaseTransport, queueRealtimeLifecycle } from "../supabase-transport";
import { getQueryPolicy } from "../sync-policy";
import { useSyncReconciliation } from "../hooks/use-sync-reconciliation";
import { subscribeNativeResume } from "../native-lifecycle";
import type { SignalPayload } from "../channels";

export { useLiveSync } from "../live-sync-context";
const DISCONNECTED = { ownConnected: false, raceConnected: false };
const serverSnapshot = () => DISCONNECTED;

export function LiveSyncProvider({ userId, initialFriends, realtimeEnabled, children }: {
  userId: string; initialFriends: FriendsState; realtimeEnabled: boolean; children: ReactNode;
}) {
  const client = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const activity = useBrowserActivity();
  const [ended, setEnded] = useState(false);
  const [signals] = useState(() => {
    let receive: (payload: SignalPayload) => void = () => {};
    return {
      emit: (payload: SignalPayload) => receive(payload),
      listen: (listener: typeof receive) => { receive = listener; },
    };
  });

  const session = useMemo(() => createRealtimeSession({
    userId,
    transport: createSupabaseTransport(),
    onRace: (payload) => applyRaceEvent(client, userId, payload),
    onSignal: signals.emit,
    onFriend: () => {
      void client.invalidateQueries({ queryKey: friendsKey(userId), exact: true }, { cancelRefetch: false });
      void client.invalidateQueries({ queryKey: raceTodayKey(userId), exact: true }, { cancelRefetch: false });
    },
  }), [client, userId, signals]);
  const health = useSyncExternalStore(session.subscribe, session.getSnapshot, serverSnapshot);
  const friends = useFriends(userId, initialFriends, getQueryPolicy({
    domain: "friends", connected: health.ownConnected, ...activity, active: !ended,
  })).data;
  const { toasts, push } = useSignalToasts({
    userId, active: !ended, visible: activity.visible,
    policy: getQueryPolicy({ domain: "signals", connected: health.ownConnected, ...activity, active: !ended }),
  });
  useEffect(() => { signals.listen(push); }, [push, signals]);
  useEffect(() => retainUserSyncQueries(client, userId), [client, userId]);

  useEffect(() => {
    let cancelled = false;
    if (realtimeEnabled && !ended) {
      void queueRealtimeLifecycle(async () => { if (!cancelled) await session.start(); })
        .catch((error: unknown) => console.warn("[realtime] subscribe failed", error));
    }
    return () => {
      cancelled = true;
      void queueRealtimeLifecycle(() => session.stop())
        .catch((error: unknown) => console.warn("[realtime] cleanup failed", error));
    };
  }, [client, userId, realtimeEnabled, ended, session]);

  const needsFriendChannels = pathname === "/" || pathname === "/ranking" || pathname === "/friends";
  const friendIds = needsFriendChannels ? friends.friends.map((friend) => friend.userId).sort().join(",") : "";
  useEffect(() => {
    void session.setFriendIds(friendIds ? friendIds.split(",") : [])
      .catch((error: unknown) => console.warn("[realtime] friend subscription failed", error));
  }, [session, friendIds]);

  useSyncReconciliation({ userId, active: !ended, ...health });

  useEffect(() => {
    if (!realtimeEnabled || ended) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeNativeResume(() => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        void queueRealtimeLifecycle(() => session.restart())
          .catch((error: unknown) => console.warn("[realtime] resume restart failed", error));
      }, 100);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [ended, realtimeEnabled, session]);

  const endSession = useCallback(async () => {
    setEnded(true);
    await queueRealtimeLifecycle(() => session.stop())
      .catch((error: unknown) => console.warn("[realtime] cleanup failed", error));
    await clearUserSyncQueries(client, userId);
  }, [client, userId, session]);

  useEffect(() => {
    let redirected = false;
    const redirectToLogin = () => {
      if (redirected) return;
      redirected = true;
      void endSession().then(() => { router.replace("/login"); router.refresh(); });
    };
    const unsubscribeExpired = subscribeSessionExpired(redirectToLogin);
    const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
      const error = event.query.state.error;
      if (redirected || !(error instanceof ApiError) || error.status !== 401) return;
      if (!userSyncKeys(userId).some((key) => JSON.stringify(key) === JSON.stringify(event.query.queryKey))) return;
      redirectToLogin();
    });
    return () => {
      unsubscribeExpired();
      unsubscribeQueries();
    };
  }, [client, userId, endSession, router]);

  return <LiveSyncContext.Provider value={{ userId, friends, ...health, ...activity, active: !ended, endSession }}>
    {children}
    {!ended && <SignalToastLayer toasts={toasts} />}
  </LiveSyncContext.Provider>;
}
