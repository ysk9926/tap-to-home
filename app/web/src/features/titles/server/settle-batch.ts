import "server-only";
import { prisma } from "@/lib/db";
import { runDateToYmd } from "@/lib/kst";
import { settleRun } from "./settle";

export type BatchReport = {
  /** "YYYY-MM-DD" */
  runDate: string;
  targeted: number;
  settled: number;
  /** 정산에 실패한 dailyRunId */
  failed: string[];
};

/**
 * 커넥션 풀이 5개뿐이라(src/lib/db) 한 번에 5건까지만 돌린다. 정산 한 건은 트랜잭션 하나와
 * 그 안의 랭킹 조회를 쓰므로 전부 Promise.all 로 던지면 풀이 마르고 서로를 기다린다.
 */
const CONCURRENCY = 5;

/**
 * 하루치 자동 정산 (자정 크론). 탭이 한 번이라도 있고 아직 정산되지 않은 run 만 대상이다 —
 * 0회 유저는 정산도 알림도 없다.
 *
 * 한 건이 실패해도 나머지는 계속 돈다. 실패는 다음 날 크론이 다시 잡지 않으므로
 * 응답의 `failed` 로 남겨 사람이 볼 수 있게 한다. 재실행은 안전하다 — settleRun 이
 * 행을 잠그고 이미 결과가 있으면 그대로 돌려준다.
 */
export async function settleAllForDate(runDate: Date, now: Date = new Date()): Promise<BatchReport> {
  const targets = await prisma.dailyRun.findMany({
    where: { runDate, tapCount: { gt: 0 }, result: null, user: { deletedAt: null } },
    select: { id: true, user: { select: { id: true, name: true, username: true } } },
  });

  const report: BatchReport = {
    runDate: runDateToYmd(runDate),
    targeted: targets.length,
    settled: 0,
    failed: [],
  };

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map(async (run) => {
        try {
          await settleRun(
            { id: run.user.id, name: run.user.name, username: run.user.username ?? "" },
            runDate,
            now,
          );
          return { id: run.id, ok: true };
        } catch (error) {
          console.error(`[settle-batch] failed for run ${run.id}`, error);
          return { id: run.id, ok: false };
        }
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.ok) report.settled += 1;
      else report.failed.push(outcome.id);
    }
  }

  return report;
}
