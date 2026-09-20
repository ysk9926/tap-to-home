"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AdminUserList, AdminUserRow } from "@/features/admin/types";
import { adminFetch } from "./admin-query-provider";
import { ContentState, LoadingState, PageHeader, StatusBadge, formatDate } from "./admin-ui";
import styles from "./admin.module.css";

const allowedKeys = ["q", "status", "activity", "friends", "sort", "from", "to", "page", "pageSize"] as const;

function activityText(value: string | null, collectionStartedAt: string | null) {
  if (value) return formatDate(value, true);
  return collectionStartedAt ? "기록 없음" : "미수집";
}

function UserMobileCard({ user, collectionStartedAt }: { user: AdminUserRow; collectionStartedAt: string | null }) {
  return (
    <Link href={`/admin/users/${user.id}`} className={styles.mobileCard}>
      <div className={styles.mobileCardHead}>
        <div><strong>{user.name}</strong> <span className={styles.muted}>@{user.username}</span></div>
        <StatusBadge status={user.status} />
      </div>
      <div className={`${styles.mobileCardMeta} ${styles.data}`}>
        <span>가입 {formatDate(user.createdAt)}</span>
        <span>친구 {user.friendCount.toLocaleString("ko-KR")}명</span>
        <span>최근 방문 {activityText(user.lastSeenAt, collectionStartedAt)}</span>
        <span>최근 30일 탭 {user.tapCount.toLocaleString("ko-KR")}회</span>
      </div>
    </Link>
  );
}

export function UsersView({ adminId }: { adminId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("q") ?? "";
  const [searchDraft, setSearchDraft] = useState({ source: currentSearch, value: currentSearch });
  const search = searchDraft.source === currentSearch ? searchDraft.value : currentSearch;

  const requestParams = new URLSearchParams();
  for (const key of allowedKeys) {
    const value = searchParams.get(key);
    if (value) requestParams.set(key, value);
  }
  if (!requestParams.has("pageSize")) requestParams.set("pageSize", "25");
  const requestString = requestParams.toString();

  const result = useQuery({
    queryKey: ["admin", adminId, "users", requestString],
    queryFn: ({ signal }) => adminFetch<AdminUserList>(`/api/admin/users?${requestString}`, { signal }),
  });

  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in values)) next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: search.trim() || null });
  }

  function reset() {
    setSearchDraft({ source: "", value: "" });
    router.replace(pathname, { scroll: false });
  }

  const currentPage = result.data?.page ?? Number(searchParams.get("page") ?? 1);
  const pageSize = result.data?.pageSize ?? Number(searchParams.get("pageSize") ?? 25);
  const totalPages = result.data ? Math.max(1, Math.ceil(result.data.total / pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="운영 기록 04"
        title="사용자 관리"
        description="계정 상태와 활동 기록을 구분해 찾고, 한 사람의 조치 이력을 이어서 확인해요."
        actions={<button type="button" className={styles.quietButton} onClick={() => void result.refetch()} disabled={result.isFetching}>새로고침</button>}
      />

      {result.data && (
        <div className={styles.notice} aria-label="계정 수 요약">
          전체 <strong className={styles.data}>{result.data.counts.all.toLocaleString("ko-KR")}</strong> · 정상 <strong className={styles.data}>{result.data.counts.active.toLocaleString("ko-KR")}</strong> · 정지 <strong className={styles.data}>{result.data.counts.suspended.toLocaleString("ko-KR")}</strong> · 탈퇴 <strong className={styles.data}>{result.data.counts.deleted.toLocaleString("ko-KR")}</strong>
        </div>
      )}

      <section className={`${styles.panel} ${styles.panelInner}`} aria-label="사용자 필터">
        <form className={styles.toolbar} onSubmit={submitSearch}>
          <div className={`${styles.field} ${styles.fieldGrow}`}>
            <label htmlFor="admin-user-search">아이디·닉네임·사용자 ID</label>
            <input id="admin-user-search" className={styles.input} type="search" value={search} onChange={(event) => setSearchDraft({ source: currentSearch, value: event.target.value })} placeholder="검색어를 입력하세요" />
          </div>
          <button type="submit" className={styles.button}>검색</button>
          <div className={styles.field}>
            <label htmlFor="admin-status">계정 상태</label>
            <select id="admin-status" className={styles.select} value={searchParams.get("status") ?? "all"} onChange={(event) => update({ status: event.target.value })}>
              <option value="all">전체</option><option value="active">정상</option><option value="suspended">이용 정지</option><option value="deleted">탈퇴</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-activity">활동 상태</label>
            <select id="admin-activity" className={styles.select} value={searchParams.get("activity") ?? "all"} onChange={(event) => update({ activity: event.target.value })}>
              <option value="all">전체</option><option value="recent">최근 7일 방문</option><option value="inactive">최근 7일 방문 없음</option><option value="never-played">가입 후 탭 없음</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-friends">친구</label>
            <select id="admin-friends" className={styles.select} value={searchParams.get("friends") ?? "all"} onChange={(event) => update({ friends: event.target.value })}>
              <option value="all">전체</option><option value="yes">친구 있음</option><option value="no">친구 없음</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-sort">정렬</label>
            <select id="admin-sort" className={styles.select} value={searchParams.get("sort") ?? "newest"} onChange={(event) => update({ sort: event.target.value })}>
              <option value="newest">최근 가입순</option><option value="oldest">오래된 가입순</option><option value="lastSeen">최근 방문순</option><option value="taps">기간 탭 많은순</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-user-from">가입 시작일</label>
            <input id="admin-user-from" className={styles.input} type="date" value={searchParams.get("from") ?? ""} onChange={(event) => update({ from: event.target.value || null })} />
          </div>
          <div className={styles.field}>
            <label htmlFor="admin-user-to">가입 종료일</label>
            <input id="admin-user-to" className={styles.input} type="date" value={searchParams.get("to") ?? ""} onChange={(event) => update({ to: event.target.value || null })} />
          </div>
          <button type="button" className={styles.quietButton} onClick={reset}>필터 초기화</button>
        </form>
      </section>

      <div style={{ marginTop: 16 }}>
        {result.isPending ? <LoadingState cards={4} /> : result.isError ? <ContentState kind="error" onRetry={() => void result.refetch()} /> : result.data.users.length === 0 ? <ContentState kind="empty" onReset={reset} /> : (
          <section className={`${styles.panel} ${styles.panelInner}`} aria-label="사용자 목록">
            <div className={`${styles.tableWrap} ${styles.desktopTable}`}>
              <table className={`${styles.table} ${styles.data}`}>
                <thead><tr><th>닉네임 / 아이디</th><th>상태</th><th>가입일</th><th>최근 방문</th><th>최근 탭</th><th>친구</th><th>최근 30일 탭</th></tr></thead>
                <tbody>
                  {result.data.users.map((user) => (
                    <tr key={user.id}>
                      <td><Link className={styles.tableLink} href={`/admin/users/${user.id}`}>{user.name}<br /><span className={styles.muted}>@{user.username}</span></Link></td>
                      <td><StatusBadge status={user.status} /></td>
                      <td className={styles.nowrap}>{formatDate(user.createdAt)}</td>
                      <td>{activityText(user.lastSeenAt, result.data.collectionStartedAt)}</td>
                      <td>{activityText(user.lastTapAt, result.data.collectionStartedAt)}</td>
                      <td>{user.friendCount.toLocaleString("ko-KR")}</td>
                      <td>{user.tapCount.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.mobileCards}>
              {result.data.users.map((user) => <UserMobileCard key={user.id} user={user} collectionStartedAt={result.data.collectionStartedAt} />)}
            </div>
            <div className={styles.pagination}>
              <button type="button" className={styles.quietButton} disabled={currentPage <= 1} onClick={() => update({ page: String(currentPage - 1) })}>이전</button>
              <span className={`${styles.paginationLabel} ${styles.data}`}>{currentPage} / {totalPages} · 총 {result.data.total.toLocaleString("ko-KR")}명</span>
              <button type="button" className={styles.quietButton} disabled={currentPage >= totalPages} onClick={() => update({ page: String(currentPage + 1) })}>다음</button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
