"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FRIEND_EVENT, userChannel } from "@/features/realtime/channels";
import { RACE_TODAY_KEY } from "@/features/race/hooks/use-race-today";
import { getSupabaseRealtime } from "@/lib/supabase/client";
import { FRIENDS_KEY } from "./use-friends";

/**
 * 내 채널의 friend 이벤트를 듣는다 (F0-3). 페이로드의 내용과 무관하게 친구 목록과
 * 레이스를 다시 읽는다 — 요청 도착·수락·삭제 모두 이 둘에 반영된다.
 * 반환값이 true 면 구독 중이라 폴링을 끌 수 있다.
 */
export function useFriendRealtime({ myId, enabled }: { myId: string; enabled: boolean }): boolean {
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseRealtime();
    const channel = supabase
      // race 화면도 같은 이름의 채널을 열지만 supabase-js 는 이름당 구독을 공유하지 않고
      // 각각 별도 구독으로 취급한다. 브로드캐스트는 이름 기준이라 둘 다 이벤트를 받는다.
      .channel(userChannel(myId))
      .on("broadcast", { event: FRIEND_EVENT }, () => {
        void queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
        void queryClient.invalidateQueries({ queryKey: RACE_TODAY_KEY });
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      setConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [enabled, myId, queryClient]);

  return connected;
}
