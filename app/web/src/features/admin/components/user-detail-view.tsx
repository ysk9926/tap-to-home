"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminAction, AdminUserDetail } from "@/features/admin/types";
import { adminFetch, AdminRequestError } from "./admin-query-provider";
import { ContentState, LoadingState, PageHeader, StatusBadge, formatDate } from "./admin-ui";
import styles from "./admin.module.css";

type ActionConfig = { action: AdminAction; title: string; description: string; confirmTarget: boolean; excluded?: boolean };

const actionLabels: Record<string, string> = {
  suspend: "이용 정지",
  unsuspend: "정지 해제",
  "revoke-sessions": "모든 기기 로그아웃",
  "analytics-exclusion": "분석 대상 변경",
};

function ModerationDialog({ config, username, pending, error, onClose, onSubmit }: {
  config: ActionConfig | null;
  username: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (config && !dialog.open) {
      setReason("");
      setConfirmation("");
      dialog.showModal();
    }
    if (!config && dialog.open) dialog.close();
  }, [config]);

  if (!config) return <dialog ref={dialogRef} />;
  const valid = reason.trim().length >= 2 && reason.trim().length <= 300 && (!config.confirmTarget || confirmation === username);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit(reason.trim());
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
      onClose={() => { if (!pending) onClose(); }}
    >
      <form onSubmit={submit}>
        <h2>{config.title}</h2>
        <p>{config.description}</p>
        <div className={styles.field}>
          <label htmlFor="moderation-reason">조치 사유</label>
          <textarea
            id="moderation-reason"
            className={styles.textarea}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={2}
            maxLength={300}
            required
            autoFocus
            placeholder="감사 이력에 남길 사유를 2자 이상 적어 주세요."
          />
          <span className={`${styles.panelNote} ${styles.data}`}>{reason.length} / 300</span>
        </div>
        {config.confirmTarget && (
          <div className={styles.field} style={{ marginTop: 12 }}>
            <label htmlFor="moderation-confirm">대상 확인 · <strong>{username}</strong> 입력</label>
            <input id="moderation-confirm" className={styles.input} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
          </div>
        )}
        {error && <p className={styles.error} role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.quietButton} onClick={onClose} disabled={pending}>취소</button>
          <button type="submit" className={config.action === "suspend" ? styles.dangerButton : styles.button} disabled={!valid || pending}>
            {pending ? "기록하는 중…" : config.title}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function AuditRows({ entries }: { entries: AdminUserDetail["audit"] }) {
  if (entries.length === 0) return <p className={styles.stateText}>아직 관리 조치가 없어요.</p>;
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.data}`}>
        <thead><tr><th>시각</th><th>조치</th><th>조치자</th><th>사유</th></tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id}><td className={styles.nowrap}>{formatDate(entry.createdAt, true)}</td><td>{actionLabels[entry.action] ?? entry.action}</td><td>{entry.actorName}</td><td>{entry.reason}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function UserDetailView({ adminId, userId }: { adminId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ActionConfig | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ["admin", adminId, "user", userId],
    queryFn: ({ signal }) => adminFetch<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`, { signal }),
  });
  const mutation = useMutation({
    mutationFn: ({ config, reason }: { config: ActionConfig; reason: string }) => adminFetch<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(userId)}/${config.action}`,
      { method: "POST", body: JSON.stringify(config.action === "analytics-exclusion" ? { reason, excluded: config.excluded } : { reason }) },
    ),
    onSuccess: async () => {
      setDialog(null);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", adminId] });
    },
    onError: (error) => setActionError(error instanceof AdminRequestError ? error.message : "조치를 완료하지 못했어요."),
  });

  if (result.isPending) return <><PageHeader eyebrow="사용자 기록" title="사용자 상세" description="계정과 플레이 기록을 불러오고 있어요." /><LoadingState cards={4} /></>;
  if (result.isError) return <><PageHeader eyebrow="사용자 기록" title="사용자 상세" description="계정과 플레이 기록을 확인합니다." /><ContentState kind="error" onRetry={() => void result.refetch()} /></>;

  const { user } = result.data;
  const openAction = (config: ActionConfig) => { setActionError(null); setDialog(config); };

  return (
    <>
      <Link href="/admin/users" className={styles.tableLink}>← 사용자 관리</Link>
      <div style={{ marginTop: 18 }}>
        <PageHeader
          eyebrow={`사용자 ID · ${user.id}`}
          title={user.name}
          description={`@${user.username}의 계정 상태, 최근 플레이와 관리 기록입니다.`}
          actions={<StatusBadge status={user.status} />}
        />
      </div>

      <section className={`${styles.panel} ${styles.panelInner}`}>
        <div className={styles.sectionHeading}><h2>계정 정보</h2><p className={styles.data}>민감한 인증·기기 정보는 표시하지 않음</p></div>
        <dl className={`${styles.definitionList} ${styles.data}`}>
          <dt>사용자 ID</dt><dd>{user.id}</dd>
          <dt>가입일</dt><dd>{formatDate(user.createdAt, true)}</dd>
          <dt>계정 상태</dt><dd><StatusBadge status={user.status} /> {user.suspensionReason && <span>· {user.suspensionReason}</span>}</dd>
          <dt>최근 방문</dt><dd>{formatDate(user.lastSeenAt, true)}</dd>
          <dt>최근 탭</dt><dd>{formatDate(user.lastTapAt, true)}</dd>
          <dt>친구 / 최근 30일 탭</dt><dd>{user.friendCount.toLocaleString("ko-KR")}명 / {user.tapCount.toLocaleString("ko-KR")}회</dd>
          <dt>제품 분석</dt><dd>{user.analyticsExcluded ? "집계에서 제외" : "집계에 포함"}</dd>
        </dl>
        {user.status !== "deleted" && (
          <div className={styles.actionBar} style={{ marginTop: 18 }}>
            {user.status === "suspended" ? (
              <button type="button" className={styles.button} onClick={() => openAction({ action: "unsuspend", title: "정지 해제", description: "로그인과 푸시 등록은 사용자가 다시 진행해야 합니다.", confirmTarget: false })}>정지 해제</button>
            ) : (
              <button type="button" className={styles.dangerButton} onClick={() => openAction({ action: "suspend", title: "이용 정지", description: "계정을 정지하고 살아 있는 일반 사용자 세션과 푸시 토큰을 제거합니다.", confirmTarget: true })}>이용 정지</button>
            )}
            <button type="button" className={styles.quietButton} onClick={() => openAction({ action: "revoke-sessions", title: "모든 기기 로그아웃", description: "현재 로그인된 일반 사용자 세션을 모두 만료시킵니다. 이후 다시 로그인할 수 있습니다.", confirmTarget: true })}>모든 기기 로그아웃</button>
            <button type="button" className={styles.quietButton} onClick={() => openAction({ action: "analytics-exclusion", title: user.analyticsExcluded ? "분석에 다시 포함" : "분석에서 제외", description: "변경하면 과거 기간 집계도 현재 설정을 기준으로 다시 계산됩니다.", confirmTarget: false, excluded: !user.analyticsExcluded })}>{user.analyticsExcluded ? "분석에 다시 포함" : "분석에서 제외"}</button>
          </div>
        )}
      </section>

      <div className={styles.equalColumns}>
        <section className={`${styles.panel} ${styles.panelInner}`}>
          <div className={styles.sectionHeading}><h2>최근 플레이</h2><p>최근 30일</p></div>
          {result.data.runs.length === 0 ? <p className={styles.stateText}>저장된 플레이 기록이 없어요.</p> : (
            <div className={styles.tableWrap}><table className={`${styles.table} ${styles.data}`}><thead><tr><th>날짜</th><th>탭</th><th>구간</th><th>정산</th></tr></thead><tbody>
              {result.data.runs.map((run) => <tr key={run.date}><td>{run.date}</td><td>{run.taps.toLocaleString("ko-KR")}</td><td>{run.stage}</td><td>{run.settled ? "완료" : "미정산"}</td></tr>)}
            </tbody></table></div>
          )}
        </section>
        <section className={`${styles.panel} ${styles.panelInner}`}>
          <div className={styles.sectionHeading}><h2>친구·칭호</h2><p>현재 관계와 누적 획득</p></div>
          <h3 className={styles.panelTitle}>칭호</h3>
          {result.data.titles.length === 0 ? <p className={styles.stateText}>획득한 칭호가 없어요.</p> : <ul className={styles.data}>{result.data.titles.map((title) => <li key={title.id}>{title.name} · {title.earnedCount.toLocaleString("ko-KR")}회</li>)}</ul>}
          <h3 className={styles.panelTitle} style={{ marginTop: 18 }}>친구</h3>
          {result.data.friends.length === 0 ? <p className={styles.stateText}>현재 정상 상태의 친구가 없어요.</p> : <ul className={styles.data}>{result.data.friends.map((friend) => <li key={friend.id}>{friend.name} <span className={styles.muted}>@{friend.username}</span></li>)}</ul>}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.panelInner}`} style={{ marginTop: 16 }}>
        <div className={styles.sectionHeading}><h2>관리 이력</h2><Link href={`/admin/audit?targetUserId=${encodeURIComponent(user.id)}`} className={styles.tableLink}>전체 이력 보기 →</Link></div>
        <AuditRows entries={result.data.audit} />
      </section>

      <ModerationDialog
        config={dialog}
        username={user.username}
        pending={mutation.isPending}
        error={actionError}
        onClose={() => { if (!mutation.isPending) { setDialog(null); setActionError(null); } }}
        onSubmit={(reason) => { if (dialog) mutation.mutate({ config: dialog, reason }); }}
      />
    </>
  );
}
