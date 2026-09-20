export type ReconcileReason = "resume" | "online" | "realtime" | "midnight";
export type Reconciler = { request(reason: ReconcileReason): void; dispose(): void };
export type ReconcilerOptions = { canRun: () => boolean; run: () => Promise<void> };

/** 여러 복귀 이벤트를 합친다. 실패한 HTTP의 재시도는 Query가 담당한다. */
export function createReconciler({ canRun, run }: ReconcilerOptions): Reconciler {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let running = false;
  let disposed = false;

  function schedule() {
    if (disposed || running || timer !== undefined || !pending || !canRun()) return;
    timer = setTimeout(async () => {
      timer = undefined;
      if (disposed || !canRun()) return;
      pending = false;
      running = true;
      try {
        await run();
      } catch {
        // 다음 복귀나 정기 조회로 회복한다. 무한 재시도하지 않는다.
      } finally {
        running = false;
        schedule();
      }
    }, 100);
  }

  return {
    request() {
      if (disposed) return;
      pending = true;
      schedule();
    },
    dispose() {
      disposed = true;
      pending = false;
      clearTimeout(timer);
    },
  };
}
