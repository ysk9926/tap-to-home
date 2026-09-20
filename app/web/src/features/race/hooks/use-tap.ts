"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { withRacerCount, type RaceToday } from "../race-state";
import { createTapBatcher, type TapBatcher } from "../tap-batcher";
import { raceTodayKey } from "@/features/realtime/query-keys";
import { HOME_THRESHOLD } from "../stages";

type TapResponse = { tapCount: number; stage: number; date: string };

/**
 * 탭 한 번 = 캐시의 내 카운트 +1 (즉시) + 프레임 토글 + 배치 전송.
 * 서버 응답으로 재동기화: 서버 누적 + 아직 안 보낸 탭.
 *
 * 배치기는 커밋되는 effect 안에서 매번 새로 만든다(= useState 초기값으로 한 번만 만들지
 * 않는다). React StrictMode 의 dev 모드 시뮬레이션 언마운트는 effect cleanup 만 실행하고
 * useState 초기값은 다시 실행하지 않으므로, useState 로 한 번만 만들면 시뮬레이션
 * 언마운트 때 dispose 된 인스턴스가 그대로 남아 이후 탭이 전송되지 않는다. effect 안에서
 * 만들면 시뮬레이션 재마운트 때 새 effect 가 다시 실행되어 새 배치기가 생긴다.
 */
export function useTap({ userId, date, onTap }: { userId: string; date: string; onTap?: (at: number) => void }) {
  const queryClient = useQueryClient();
  const [frame, setFrame] = useState<0 | 1>(0);
  const onTapRef = useRef(onTap);
  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const batcherRef = useRef<TapBatcher | null>(null);

  useEffect(() => {
    const batcher = createTapBatcher(async (count) => {
      // Never flush yesterday's queued taps into a newly loaded day.
      if (queryClient.getQueryData<RaceToday>(raceTodayKey(userId))?.date !== date) return;
      try {
        const res = await fetchJson<TapResponse>("/api/taps", {
          method: "POST",
          body: JSON.stringify({ count }),
        });
        if (res.date !== date) {
          void queryClient.invalidateQueries({ queryKey: raceTodayKey(userId) });
          return;
        }
        queryClient.setQueryData<RaceToday>(raceTodayKey(userId), (data) =>
          data && data.date === date && !data.settled ? withRacerCount(data, data.me.userId,
            res.tapCount >= HOME_THRESHOLD ? res.tapCount : Math.min(HOME_THRESHOLD, res.tapCount + batcher.pending()),
          ) : data,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // 레이스가 이미 마감됨: settled 로 표시하고 서버 값으로 다시 동기화한다 (재시도하지 않는다)
          queryClient.setQueryData<RaceToday>(raceTodayKey(userId), (data) =>
            data && data.date === date ? { ...data, settled: true } : data,
          );
          void queryClient.invalidateQueries({ queryKey: raceTodayKey(userId) });
          return;
        }
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          // 그 외 4xx(잘못된 요청, 인증 만료 등)는 재시도해도 성공할 수 없다: 이 배치는 버린다
          return;
        }
        throw e; // 5xx·네트워크 오류: batcher 가 백오프 뒤 재큐잉한다
      }
    });
    batcherRef.current = batcher;
    return () => {
      batcherRef.current = null;
      void batcher.flush(); // 언마운트 직전에 쌓인 탭은 보낸다
      batcher.dispose();
    };
  }, [queryClient, userId, date]);

  const tap = useCallback(() => {
    // Read the synchronous cache so bursts in a single render cannot pass the finish line.
    const data = queryClient.getQueryData<RaceToday>(raceTodayKey(userId));
    if (!data || data.date !== date || data.settled || data.me.tapCount >= HOME_THRESHOLD) return;
    const at = Date.now();
    setFrame((f) => (f === 0 ? 1 : 0));
    queryClient.setQueryData<RaceToday>(raceTodayKey(userId), (data) =>
      data && !data.settled ? withRacerCount(data, data.me.userId, data.me.tapCount + 1) : data,
    );
    batcherRef.current?.tap();
    onTapRef.current?.(at);
  }, [queryClient, userId, date]);

  return { tap, frame };
}
