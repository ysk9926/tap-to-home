import "server-only";
import { sqltag as sql } from "@prisma/client/runtime/client";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { kstDate, runDateToYmd } from "@/lib/kst";
import { AdminError } from "@/lib/admin-auth/config";
import { TITLES } from "@/features/titles/catalog";
import type { AdminAction, AdminAuditList, AdminAuditRow, AdminUserDetail, AdminUserList, AdminUserRow } from "../types";

const DAY = 86_400_000;
function choice(params: URLSearchParams, key: string, values: string[], fallback: string): string {
  const value = params.get(key) ?? fallback;
  if (!values.includes(value)) throw new AdminError(400, `${key} 필터를 확인해 주세요`);
  return value;
}
function pageNumber(params: URLSearchParams, key: string, fallback: number, max: number) {
  const raw = params.get(key) ?? String(fallback);
  if (!/^\d+$/.test(raw)) throw new AdminError(400, "페이지 범위를 확인해 주세요");
  const value = Number(raw);
  if (value < 1 || value > max) throw new AdminError(400, "페이지 범위를 확인해 주세요");
  return value;
}
function dateFilter(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AdminError(400, "가입일을 확인해 주세요");
  const day = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) throw new AdminError(400, "가입일을 확인해 주세요");
  return new Date(day.getTime() - 9 * 3600_000);
}

type UserRow = {
  id: string; username: string | null; name: string; createdAt: Date;
  deletedAt: Date | null; suspendedAt: Date | null; suspensionReason: string | null;
  analyticsExcluded: boolean; lastSeenAt: Date | null; lastTapAt: Date | null;
  friendCount: number; tapCount: number; hasPlayed: boolean;
};
function userRows(now: Date) {
  const since = new Date(kstDate(now).getTime() - 29 * DAY);
  return sql`SELECT u.id, u.username, u.name, u."createdAt", u."deletedAt", u."suspendedAt", u."suspensionReason", u."analyticsExcluded",
    (SELECT MAX(a."lastSeenAt") FROM user_daily_activity a WHERE a."userId" = u.id) AS "lastSeenAt",
    (SELECT MAX(r."lastTapAt") FROM daily_run r WHERE r."userId" = u.id) AS "lastTapAt",
    (SELECT COALESCE(SUM(r."tapCount"),0)::int FROM daily_run r WHERE r."userId" = u.id AND r."runDate" >= ${since} AND r."runDate" <= ${kstDate(now)}) AS "tapCount",
    EXISTS(SELECT 1 FROM daily_run r WHERE r."userId" = u.id AND r."tapCount" > 0) AS "hasPlayed",
    (SELECT COUNT(DISTINCT other.id)::int FROM friendship f JOIN "user" other
      ON other.id = CASE WHEN f."requesterId" = u.id THEN f."addresseeId" ELSE f."requesterId" END
      WHERE (f."requesterId" = u.id OR f."addresseeId" = u.id) AND f.status = 'accepted'
        AND other."deletedAt" IS NULL AND other."suspendedAt" IS NULL) AS "friendCount"
    FROM "user" u`;
}
function publicUser(row: UserRow): AdminUserRow {
  return {
    id: row.id, username: row.username ?? "", name: row.name, createdAt: row.createdAt.toISOString(),
    status: row.deletedAt ? "deleted" : row.suspendedAt ? "suspended" : "active",
    suspendedAt: row.suspendedAt?.toISOString() ?? null, suspensionReason: row.suspensionReason,
    analyticsExcluded: row.analyticsExcluded, lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastTapAt: row.lastTapAt?.toISOString() ?? null, friendCount: row.friendCount, tapCount: row.tapCount,
  };
}

export async function listAdminUsers(params: URLSearchParams, now = new Date()): Promise<AdminUserList> {
  const page = pageNumber(params, "page", 1, 100_000);
  const pageSize = pageNumber(params, "pageSize", 25, 100);
  const q = (params.get("q") ?? "").trim();
  if (q.length > 80) throw new AdminError(400, "검색어는 80자 이내로 입력해 주세요");
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const status = choice(params, "status", ["all", "active", "suspended", "deleted"], "all");
  const activity = choice(params, "activity", ["all", "recent", "inactive", "never-played"], "all");
  const friends = choice(params, "friends", ["all", "yes", "no"], "all");
  const sort = choice(params, "sort", ["newest", "oldest", "lastSeen", "taps"], "newest");
  const from = dateFilter(params.get("from"));
  const to = dateFilter(params.get("to"));
  if (from && to && from > to) throw new AdminError(400, "가입일 범위를 확인해 주세요");
  const until = to ? new Date(to.getTime() + DAY) : null;
  const since = new Date(kstDate(now).getTime() - 6 * DAY - 9 * 3600_000);
  const config = await prisma.analyticsConfig.findUnique({ where: { id: "product" } });
  const start = config?.startedAt ?? null;
  const filtered = sql`WITH member AS (${userRows(now)}) SELECT * FROM member WHERE
    (${q} = '' OR id = ${q} OR username ILIKE ${pattern} OR name ILIKE ${pattern}) AND
    (${status} = 'all' OR (${status} = 'active' AND "deletedAt" IS NULL AND "suspendedAt" IS NULL)
      OR (${status} = 'suspended' AND "deletedAt" IS NULL AND "suspendedAt" IS NOT NULL)
      OR (${status} = 'deleted' AND "deletedAt" IS NOT NULL)) AND
    (${activity} = 'all' OR (${activity} = 'recent' AND "lastSeenAt" >= ${since})
      OR (${activity} = 'never-played' AND NOT "hasPlayed")
      OR (${activity} = 'inactive' AND ${start}::timestamp IS NOT NULL AND ${start}::timestamp <= GREATEST("createdAt", ${since})
        AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${since}))) AND
    (${friends} = 'all' OR (${friends} = 'yes' AND "friendCount" > 0) OR (${friends} = 'no' AND "friendCount" = 0)) AND
    (${from}::timestamp IS NULL OR "createdAt" >= ${from}) AND (${until}::timestamp IS NULL OR "createdAt" < ${until})`;
  const [rows, total, counts] = await Promise.all([
    prisma.$queryRaw<UserRow[]>(sql`SELECT * FROM (${filtered}) f ORDER BY
      CASE WHEN ${sort} = 'oldest' THEN "createdAt" END ASC,
      CASE WHEN ${sort} = 'newest' THEN "createdAt" END DESC,
      CASE WHEN ${sort} = 'lastSeen' THEN "lastSeenAt" END DESC NULLS LAST,
      CASE WHEN ${sort} = 'taps' THEN "tapCount" END DESC, id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
    prisma.$queryRaw<{ count: number }[]>(sql`SELECT COUNT(*)::int AS count FROM (${filtered}) f`),
    prisma.$queryRaw<AdminUserList["counts"][]>`SELECT COUNT(*)::int AS all,
      COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "suspendedAt" IS NULL)::int AS active,
      COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "suspendedAt" IS NOT NULL)::int AS suspended,
      COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::int AS deleted FROM "user"`,
  ]);
  return { users: rows.map(publicUser), total: total[0].count, counts: counts[0], page, pageSize, collectionStartedAt: start?.toISOString() ?? null };
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
export async function listAdminAudit(params: URLSearchParams): Promise<AdminAuditList> {
  const page = pageNumber(params, "page", 1, 100_000);
  const pageSize = pageNumber(params, "pageSize", 25, 100);
  const targetUserId = params.get("targetUserId") || undefined;
  if (targetUserId && targetUserId.length > 100) throw new AdminError(400, "대상 ID를 확인해 주세요");
  const where = { targetUserId };
  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, targetUserId: true, action: true, reason: true, before: true, after: true, createdAt: true,
        actor: { select: { name: true } }, target: { select: { username: true } } } }),
    prisma.adminAuditLog.count({ where }),
  ]);
  const entries: AdminAuditRow[] = rows.map((row) => ({
    id: row.id, actorName: row.actor.name, targetUserId: row.targetUserId, targetUsername: row.target.username ?? "",
    action: row.action, reason: row.reason, before: jsonRecord(row.before), after: jsonRecord(row.after), createdAt: row.createdAt.toISOString(),
  }));
  return { entries, total, page, pageSize };
}

export async function getAdminUserDetail(userId: string, now = new Date()): Promise<AdminUserDetail> {
  const rows = await prisma.$queryRaw<UserRow[]>(sql`SELECT * FROM (${userRows(now)}) f WHERE id = ${userId}`);
  if (!rows[0]) throw new AdminError(404, "사용자를 찾을 수 없습니다");
  const relatedUserSelect = { id: true, username: true, name: true, deletedAt: true, suspendedAt: true } as const;
  const [runs, titles, connections, audit] = await Promise.all([
    prisma.dailyRun.findMany({ where: { userId, runDate: { gte: new Date(kstDate(now).getTime() - 29 * DAY), lte: kstDate(now) } },
      orderBy: { runDate: "desc" }, select: { runDate: true, tapCount: true, stage: true, result: { select: { dailyRunId: true } } } }),
    prisma.userTitle.findMany({ where: { userId }, select: { titleId: true, earnedCount: true } }),
    prisma.friendship.findMany({
      where: {
        AND: [
          { OR: [{ requesterId: userId }, { addresseeId: userId }] },
          { OR: [{ status: "accepted" }, { status: "blocked", blockedById: userId }] },
        ],
      },
      orderBy: [{ respondedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      select: {
        status: true, respondedAt: true,
        requester: { select: relatedUserSelect }, addressee: { select: relatedUserSelect },
      },
    }),
    listAdminAudit(new URLSearchParams({ targetUserId: userId, pageSize: "25" })),
  ]);
  const friends = new Map<string, AdminUserDetail["friends"][number]>();
  const blockedUsers = new Map<string, AdminUserDetail["blockedUsers"][number]>();
  for (const connection of connections) {
    const other = connection.requester.id === userId ? connection.addressee : connection.requester;
    const status: AdminUserRow["status"] = other.deletedAt ? "deleted" : other.suspendedAt ? "suspended" : "active";
    const user = { id: other.id, username: other.username ?? "", name: other.name, status };
    const respondedAt = connection.respondedAt?.toISOString() ?? null;
    if (connection.status === "accepted" && !friends.has(other.id)) {
      friends.set(other.id, { ...user, acceptedAt: respondedAt });
    } else if (connection.status === "blocked" && !blockedUsers.has(other.id)) {
      blockedUsers.set(other.id, { ...user, blockedAt: respondedAt });
    }
  }
  return { user: publicUser(rows[0]),
    runs: runs.map((r) => ({ date: runDateToYmd(r.runDate), taps: r.tapCount, stage: r.stage, settled: r.result !== null })),
    titles: titles.map((t) => ({ id: t.titleId, name: TITLES.find((entry) => entry.id === t.titleId)?.name ?? t.titleId, earnedCount: t.earnedCount })),
    friends: [...friends.values()], blockedUsers: [...blockedUsers.values()], audit: audit.entries,
  };
}

export async function moderateUser(
  adminId: string, userId: string, action: AdminAction, input: { reason: string; excluded?: boolean },
): Promise<{ ok: true }> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 2 || reason.length > 300) throw new AdminError(400, "사유를 2~300자로 입력해 주세요");
  if (!["suspend", "unsuspend", "revoke-sessions", "analytics-exclusion"].includes(action)) throw new AdminError(404, "없는 관리 작업입니다");
  if (action === "analytics-exclusion" && typeof input.excluded !== "boolean") throw new AdminError(400, "분석 제외 여부를 확인해 주세요");
  await prisma.$transaction(async (tx) => {
    const masters = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM admin_user WHERE id = ${adminId} AND "disabledAt" IS NULL FOR UPDATE`;
    if (adminId !== "master" || !masters.length) throw new AdminError(403, "마스터 계정을 확인해 주세요");
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true, suspendedAt: true, suspensionReason: true, analyticsExcluded: true } });
    if (!user) throw new AdminError(404, "사용자를 찾을 수 없습니다");
    if (user.deletedAt) throw new AdminError(409, "탈퇴한 계정은 변경할 수 없습니다");
    if ((action === "suspend" && user.suspendedAt) || (action === "unsuspend" && !user.suspendedAt)) throw new AdminError(409, "계정 상태가 변경되었습니다. 새로고침해 주세요");
    const before = { suspendedAt: user.suspendedAt?.toISOString() ?? null, suspensionReason: user.suspensionReason, analyticsExcluded: user.analyticsExcluded };
    const data = action === "suspend" ? { suspendedAt: new Date(), suspensionReason: reason }
      : action === "unsuspend" ? { suspendedAt: null, suspensionReason: null }
      : action === "analytics-exclusion" ? { analyticsExcluded: input.excluded } : {};
    const updated = await tx.user.update({ where: { id: userId }, data, select: { suspendedAt: true, suspensionReason: true, analyticsExcluded: true } });
    let revokedSessions = 0;
    if (action === "suspend" || action === "revoke-sessions") revokedSessions = (await tx.session.deleteMany({ where: { userId } })).count;
    if (action === "suspend") await tx.pushToken.deleteMany({ where: { userId } });
    await tx.adminAuditLog.create({ data: {
      actorAdminId: adminId, targetUserId: userId, action, reason, before,
      after: { ...updated, suspendedAt: updated.suspendedAt?.toISOString() ?? null, revokedSessions },
    } });
  });
  return { ok: true };
}
