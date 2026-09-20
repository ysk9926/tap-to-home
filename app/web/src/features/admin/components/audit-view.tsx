"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminAuditList } from "@/features/admin/types";
import { adminFetch } from "./admin-query-provider";
import { ContentState, LoadingState, PageHeader, formatDate } from "./admin-ui";
import styles from "./admin.module.css";

const actionLabels: Record<string, string> = {
  suspend: "이용 정지",
  unsuspend: "정지 해제",
  "revoke-sessions": "모든 기기 로그아웃",
  "analytics-exclusion": "분석 대상 변경",
};

function jsonSummary(value: Record<string, unknown>) {
  const labels: Record<string, string> = {
    suspendedAt: "정지 시각", suspensionReason: "정지 사유",
    analyticsExcluded: "분석 제외", revokedSessions: "만료한 세션 수",
  };
  const entries = Object.entries(value);
  if (entries.length === 0) return "기록 없음";
  return entries.map(([key, item]) => {
    const text = key === "suspendedAt" && typeof item === "string" ? formatDate(item, true)
      : typeof item === "boolean" ? (item ? "예" : "아니요") : String(item ?? "없음");
    return `${labels[key] ?? key}: ${text}`;
  }).join(" · ");
}

export function AuditView({ adminId }: { adminId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTarget = searchParams.get("targetUserId") ?? "";
  const [targetDraft, setTargetDraft] = useState({ source: currentTarget, value: currentTarget });
  const target = targetDraft.source === currentTarget ? targetDraft.value : currentTarget;

  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const request = new URLSearchParams({ page: String(page) });
  const targetUserId = searchParams.get("targetUserId");
  if (targetUserId) request.set("targetUserId", targetUserId);
  const queryString = request.toString();
  const result = useQuery({
    queryKey: ["admin", adminId, "audit", queryString],
    queryFn: ({ signal }) => adminFetch<AdminAuditList>(`/api/admin/audit?${queryString}`, { signal }),
  });

  function navigate(nextPage: number, nextTarget = targetUserId) {
    const next = new URLSearchParams();
    if (nextPage > 1) next.set("page", String(nextPage));
    if (nextTarget) next.set("targetUserId", nextTarget);
    const value = next.toString();
    router.replace(value ? `${pathname}?${value}` : pathname, { scroll: false });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    navigate(1, target.trim() || null);
  }

  const totalPages = result.data ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="사용자 관리 · 기록"
        title="관리 이력"
        description="누가, 어떤 사용자에게, 왜 조치했는지 변경 전후 상태와 함께 남깁니다."
        actions={<button type="button" className={styles.quietButton} onClick={() => void result.refetch()} disabled={result.isFetching}>새로고침</button>}
      />
      <section className={`${styles.panel} ${styles.panelInner}`}>
        <form className={styles.toolbar} onSubmit={submit}>
          <div className={`${styles.field} ${styles.fieldGrow}`}>
            <label htmlFor="audit-target">대상 사용자 ID</label>
            <input id="audit-target" className={styles.input} value={target} onChange={(event) => setTargetDraft({ source: currentTarget, value: event.target.value })} placeholder="정확한 사용자 ID" />
          </div>
          <button type="submit" className={styles.button}>찾기</button>
          <button type="button" className={styles.quietButton} onClick={() => { setTargetDraft({ source: "", value: "" }); navigate(1, null); }}>필터 초기화</button>
        </form>
      </section>

      <div style={{ marginTop: 16 }}>
        {result.isPending ? <LoadingState cards={4} /> : result.isError ? <ContentState kind="error" onRetry={() => void result.refetch()} /> : result.data.entries.length === 0 ? <ContentState kind="empty" onReset={() => navigate(1, null)} /> : (
          <section className={`${styles.panel} ${styles.panelInner}`}>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.data}`}>
                <thead><tr><th>시각</th><th>조치</th><th>대상</th><th>조치자</th><th>사유</th><th>변경</th></tr></thead>
                <tbody>
                  {result.data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className={styles.nowrap}>{formatDate(entry.createdAt, true)}</td>
                      <td>{actionLabels[entry.action] ?? entry.action}</td>
                      <td><Link href={`/admin/users/${entry.targetUserId}`} className={styles.tableLink}>@{entry.targetUsername}</Link></td>
                      <td>{entry.actorName}</td>
                      <td>{entry.reason}</td>
                      <td>
                        <details className={styles.details}>
                          <summary>전후 보기</summary>
                          <div><strong>전:</strong> {jsonSummary(entry.before)}</div>
                          <div><strong>후:</strong> {jsonSummary(entry.after)}</div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <button type="button" className={styles.quietButton} disabled={result.data.page <= 1} onClick={() => navigate(result.data.page - 1)}>이전</button>
              <span className={`${styles.paginationLabel} ${styles.data}`}>{result.data.page} / {totalPages} · 총 {result.data.total.toLocaleString("ko-KR")}건</span>
              <button type="button" className={styles.quietButton} disabled={result.data.page >= totalPages} onClick={() => navigate(result.data.page + 1)}>다음</button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
