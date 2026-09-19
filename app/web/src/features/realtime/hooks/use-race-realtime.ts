"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseRealtime } from "@/lib/supabase/client";
import { RACE_EVENT, SIGNAL_EVENT, userChannel, type RacePayload, type SignalPayload } from "../channels";

type Options = {
  myId: string;
  friendIds: string[];
  onRace: (payload: RacePayload) => void;
  onSignal: (payload: SignalPayload) => void;
  enabled: boolean;
  /**
   * connected 상태가 바뀔 때마다 호출된다 (subscribe() 콜백 안에서 직접 부르므로 useEffect
   * 본문 setState 가 아니라 react-hooks/set-state-in-effect 에 걸리지 않는다). 옵셔널 —
   * 반환값 connected 만 읽어도 된다. useRaceSession 은 이 값으로 useRaceToday/useSignalToasts 의
   * polling 여부를 결정하는데, 그 두 훅은 friendIds 의 재료인 data.racers 보다 먼저 호출돼야
   * 해서 이 훅의 반환값을 되돌아 참조할 수 없다 — 그래서 useRaceSession 이 connected 를
   * useState 로 직접 소유하고 이 콜백으로 갱신받는다.
   */
  onConnectedChange?: (connected: boolean) => void;
};

/**
 * 내 채널(signal) + 친구 채널(race) 구독. 내 채널이 SUBSCRIBED 되면 connected=true 이고
 * 화면은 폴링을 끈다. enabled=false 면 구독하지 않는다 (폴링 유지) — 서버 컴포넌트(page.tsx)가
 * 세 환경변수(URL, publishable key, secret key)를 모두 확인한 결과를 내려준다. secret key 가
 * 없으면 브로드캐스트 자체가 나가지 않으므로, 브라우저가 구독해도 이벤트를 받을 수 없다.
 */
export function useRaceRealtime({
  myId,
  friendIds,
  onRace,
  onSignal,
  enabled,
  onConnectedChange,
}: Options): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onRaceRef = useRef(onRace);
  const onSignalRef = useRef(onSignal);
  const onConnectedChangeRef = useRef(onConnectedChange);
  // react-hooks/refs(v7) 는 렌더 중 ref.current 쓰기를 금지한다 — 브리프의 "렌더 중 대입"
  // 패턴 대신 매 렌더 뒤 실행되는 effect 로 옮긴다 (deps 없음 → 매 렌더 후 실행, 아래
  // 구독 effect보다 선언 순서상 먼저 실행되므로 구독이 항상 최신 콜백을 참조한다).
  useEffect(() => {
    onRaceRef.current = onRace;
    onSignalRef.current = onSignal;
    onConnectedChangeRef.current = onConnectedChange;
  });
  const friendKey = [...friendIds].sort().join(",");

  const setConnectedState = (next: boolean) => {
    setConnected(next);
    onConnectedChangeRef.current?.(next);
  };

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseRealtime();
    const ids = friendKey ? friendKey.split(",") : [];

    const mine = supabase
      .channel(userChannel(myId))
      .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => onSignalRef.current(payload as SignalPayload))
      .subscribe((status) => setConnectedState(status === "SUBSCRIBED"));

    const friends = ids.map((id) =>
      supabase
        .channel(userChannel(id))
        .on("broadcast", { event: RACE_EVENT }, ({ payload }) => onRaceRef.current(payload as RacePayload))
        .subscribe(),
    );

    return () => {
      setConnectedState(false);
      void supabase.removeChannel(mine);
      friends.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [enabled, myId, friendKey]);

  return { connected };
}
