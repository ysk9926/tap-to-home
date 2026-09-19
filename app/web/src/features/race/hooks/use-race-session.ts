"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRaceRealtime } from "@/features/realtime/hooks/use-race-realtime";
import { useSignalToasts } from "@/features/signal/hooks/use-signal-toasts";
import { withRacerCount, type RaceToday } from "../race-state";
import { RACE_TODAY_KEY, useRaceToday } from "./use-race-today";

/**
 * 오늘 레이스 + 실시간 구독 + 신호 토스트를 한 묶음으로. 레이스(`/`)와 랭킹(`/ranking`)
 * 두 화면이 같은 세션을 각자 연다 — 같은 react-query 키를 쓰므로 탭을 옮겨도 카운트가
 * 유지되고, 구독은 화면마다 붙었다 떨어진다.
 *
 * 훅 순서에 주의: useRaceRealtime 의 friendIds 는 data.racers 에서 뽑아야 해서
 * useRaceToday·useSignalToasts 뒤에 와야 하는데, 그 두 훅의 polling 여부는 반대로
 * useRaceRealtime 의 connected 가 필요하다. 되돌아 참조할 수 없으므로 connected 는
 * 여기서 useState 로 소유하고 useRaceRealtime 에는 갱신용 setter 를 넘긴다. setter 는
 * subscribe() 콜백(이벤트 핸들러)에서 호출되므로 useEffect 본문 setState 가 아니라
 * react-hooks/set-state-in-effect 에 걸리지 않는다.
 */
export function useRaceSession(initial: RaceToday, { realtimeEnabled }: { realtimeEnabled: boolean }) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const { data } = useRaceToday(initial, { polling: !connected });
  const { toasts, push } = useSignalToasts({ polling: !connected });

  useRaceRealtime({
    myId: initial.me.userId,
    friendIds: data.racers.filter((r) => !r.isMe).map((r) => r.userId),
    onRace: (p) => {
      queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (cur) =>
        cur && cur.date === p.date && p.userId !== cur.me.userId ? withRacerCount(cur, p.userId, p.tapCount) : cur,
      );
    },
    onSignal: push,
    enabled: realtimeEnabled,
    onConnectedChange: setConnected,
  });

  return { data, connected, toasts };
}
