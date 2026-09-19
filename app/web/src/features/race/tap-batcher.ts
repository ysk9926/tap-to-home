export type TapBatcher = {
  /** 탭 하나 누적. delayMs 뒤 한 번에 보낸다 */
  tap(): void;
  /** 아직 서버에 보내지 못한 탭 수 */
  pending(): number;
  /** 즉시 전송 시도 */
  flush(): Promise<void>;
  dispose(): void;
};

export const TAP_BATCH_DELAY_MS = 300;
/** 서버의 MAX_BATCH(`api/taps/route.ts`)와 같은 값. 한 번에 이보다 많이 보내지 않는다 */
export const MAX_TAP_BATCH = 50;
const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 5000];

/**
 * 탭을 300ms 로 묶어 서버에 보낸다 (docs/decisions/0002). 전송이 겹치지 않게 하고,
 * 큐가 서버 한도(50)를 넘으면 여러 번에 나눠 보낸다. 실패하면 재큐잉하고 점점 늘어나는
 * 지연 뒤 재시도한다(연속 실패 횟수 기준 백오프). 화면 카운트는 여기와 무관하게 즉시 올린다.
 */
export function createTapBatcher(
  send: (count: number) => Promise<void>,
  options: { delayMs?: number; retryDelaysMs?: number[] } = {},
): TapBatcher {
  const delayMs = options.delayMs ?? TAP_BATCH_DELAY_MS;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let queued = 0;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let consecutiveFailures = 0;

  function schedule(afterMs: number) {
    if (timer !== null || disposed) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, afterMs);
  }

  async function flush() {
    if (inFlight || queued === 0 || disposed) return;
    const count = Math.min(queued, MAX_TAP_BATCH);
    queued -= count;
    inFlight = true;
    let ok = true;
    try {
      await send(count);
    } catch {
      ok = false;
      queued += count;
    } finally {
      inFlight = false;
    }
    if (disposed) return;
    if (ok) {
      consecutiveFailures = 0;
      if (queued > 0) void flush(); // 남은 탭(청크 나머지 또는 전송 중 쌓인 탭)은 바로 보낸다
    } else {
      consecutiveFailures += 1;
      const retryDelay = retryDelaysMs[Math.min(consecutiveFailures - 1, retryDelaysMs.length - 1)];
      schedule(retryDelay); // 실패는 백오프 뒤 재시도
    }
  }

  return {
    tap() {
      queued += 1;
      schedule(delayMs);
    },
    pending: () => queued,
    flush,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
