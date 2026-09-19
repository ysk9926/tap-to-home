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

/**
 * 탭을 300ms 로 묶어 서버에 보낸다 (docs/decisions/0002). 전송이 겹치지 않게 하고,
 * 실패한 배치는 다음 배치에 합친다. 화면 카운트는 여기와 무관하게 즉시 올린다.
 */
export function createTapBatcher(
  send: (count: number) => Promise<void>,
  options: { delayMs?: number } = {},
): TapBatcher {
  const delayMs = options.delayMs ?? TAP_BATCH_DELAY_MS;
  let queued = 0;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function schedule() {
    if (timer !== null || disposed) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delayMs);
  }

  async function flush() {
    if (inFlight || queued === 0 || disposed) return;
    const count = queued;
    queued = 0;
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
    if (queued === 0 || disposed) return;
    if (ok) void flush(); // 전송 중 쌓인 탭은 바로 보낸다
    else schedule(); // 실패는 delayMs 뒤 재시도
  }

  return {
    tap() {
      queued += 1;
      schedule();
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
