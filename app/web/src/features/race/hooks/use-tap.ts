"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { withRacerCount, type RaceToday } from "../race-state";
import { createTapBatcher } from "../tap-batcher";
import { RACE_TODAY_KEY } from "./use-race-today";

type TapResponse = { tapCount: number; stage: number };

/**
 * 탭 한 번 = 캐시의 내 카운트 +1 (즉시) + 프레임 토글 + 배치 전송.
 * 서버 응답으로 재동기화: 서버 누적 + 아직 안 보낸 탭.
 */
export function useTap({ onTap }: { onTap?: (at: number) => void } = {}) {
  const queryClient = useQueryClient();
  const [frame, setFrame] = useState<0 | 1>(0);
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const [batcher] = useState(() => {
    // send 콜백이 자기 자신(배치 후 남은 pending)을 읽어야 하므로, 생성 직후 이 지역
    // 변수에 대입해 클로저로 참조한다. tap() 은 항상 useState 반환 이후에만 호출되므로
    // send 가 실행되는 시점엔 self 가 이미 채워져 있다.
    const self: ReturnType<typeof createTapBatcher> = createTapBatcher(async (count) => {
      try {
        const res = await fetchJson<TapResponse>("/api/taps", {
          method: "POST",
          body: JSON.stringify({ count }),
        });
        queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) => {
          if (!data) return data;
          const pending = self.pending();
          return withRacerCount(data, data.me.userId, res.tapCount + pending);
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) =>
            data ? { ...data, settled: true } : data,
          );
          return; // 재시도하지 않는다
        }
        throw e; // batcher 가 다음 배치에 합친다
      }
    });
    return self;
  });

  useEffect(() => {
    return () => batcher.dispose();
  }, [batcher]);

  const tap = useCallback(() => {
    const at = Date.now();
    setFrame((f) => (f === 0 ? 1 : 0));
    queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) =>
      data && !data.settled ? withRacerCount(data, data.me.userId, data.me.tapCount + 1) : data,
    );
    batcher.tap();
    onTapRef.current?.(at);
  }, [queryClient, batcher]);

  return { tap, frame };
}
