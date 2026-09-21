export type AdminIdentity = { id: string; name: string; username: string };
export type DateRange = { from: string; to: string; days: number };
export type Metric = {
  id: string; label: string; value: number | null; unit: string;
  numerator?: number; denominator?: number;
  status: "ready" | "collecting" | "empty";
  hint: string; previous?: number | null;
};
export type TrendPoint = { date: string; visitors: number | null; players: number; signups: number; activated: number | null };
export type StagePoint = { label: string; threshold: number; count: number; total: number; rate: number | null };
export type Cohort = { date: string; size: number; d1: Metric; d7: Metric };
export type DashboardData = {
  generatedAt: string; timezone: "Asia/Seoul"; range: DateRange;
  collectionStartedAt: string | null;
  metrics: Metric[]; trend: TrendPoint[]; stages: StagePoint[]; cohorts: Cohort[];
  hourly: { hour: number; taps: number; players: number }[];
  titles: { id: string; name: string; count: number }[];
  social: { label: string; size: number; retained: number; rate: number | null }[];
  unsettledRuns: number;
};
export type AdminUserRow = {
  id: string; username: string; name: string; createdAt: string;
  status: "active" | "suspended" | "deleted";
  suspendedAt: string | null; suspensionReason: string | null;
  analyticsExcluded: boolean; lastSeenAt: string | null; lastTapAt: string | null;
  friendCount: number; tapCount: number;
};
export type AdminUserList = {
  users: AdminUserRow[]; page: number; pageSize: number; total: number;
  counts: { all: number; active: number; suspended: number; deleted: number };
  collectionStartedAt: string | null;
};
export type AdminAuditRow = {
  id: string; actorName: string; targetUserId: string; targetUsername: string;
  action: string; reason: string; createdAt: string;
  before: Record<string, unknown>; after: Record<string, unknown>;
};
export type AdminAuditList = { entries: AdminAuditRow[]; total: number; page: number; pageSize: number };
export type AdminRelatedUser = Pick<AdminUserRow, "id" | "username" | "name" | "status">;
export type AdminUserDetail = {
  user: AdminUserRow;
  runs: { date: string; taps: number; stage: number; settled: boolean }[];
  titles: { id: string; name: string; earnedCount: number }[];
  friends: (AdminRelatedUser & { acceptedAt: string | null })[];
  blockedUsers: (AdminRelatedUser & { blockedAt: string | null })[];
  audit: AdminAuditRow[];
};
export type AdminAction = "suspend" | "unsuspend" | "revoke-sessions" | "analytics-exclusion";
