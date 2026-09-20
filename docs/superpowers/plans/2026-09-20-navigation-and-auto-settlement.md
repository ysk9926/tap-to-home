# 하단 탭 개편과 자동 정산 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하단 탭을 레이스·랭킹·친구·마이 4개로 재편하고, 사용자가 누르던 "오늘 정산" 을 KST 자정 크론 배치로 옮긴다.

**Architecture:** 스키마 변경 1회(마이그레이션 1개)를 먼저 깔고, 그 위에 (1) 크론 배치 + 푸시, (2) 기록 화면 `/records`, (3) 마이페이지 `/my/*`, (4) 소프트 삭제를 쌓는다. 마지막에 하단 탭을 4개로 바꾸고 옛 경로를 리다이렉트로 남긴다. 탭 전환을 마지막에 두는 이유: 그 전까지는 새 화면이 옛 화면과 공존해 언제든 되돌릴 수 있고, 탭을 먼저 바꾸면 중간 상태에서 도감·정산 결과로 가는 길이 사라진다.

**Tech Stack:** Next.js 16 (App Router, `src/`), Prisma 7 + Supabase Postgres, better-auth(username 플러그인), FCM HTTP v1, Vitest, Tailwind

**Spec:** `docs/superpowers/specs/2026-09-20-navigation-and-auto-settlement-design.md`

## Global Constraints

- 사용자 대면 문구는 **한국어**, 코드·식별자·커밋 메시지는 **영어**.
- DB 접근은 **서버에서 Prisma 로만** (`src/lib/db`). supabase-js 는 Realtime 채널 전용.
- 서버 전용 모듈은 첫 줄에 `import "server-only";`.
- 하루 기준은 **KST(UTC+9) 고정**. 날짜 계산은 `src/lib/kst.ts` 의 헬퍼만 쓴다 (`kstDate`, `todayKst`, `runDateToYmd`, `kstTimeLabel`, `kstDateLabel`).
- Prisma 커넥션 풀은 **max 5** (`src/lib/db/index.ts`). 배치는 절대 전체를 `Promise.all` 로 던지지 않는다.
- 테이블을 바꿀 때는 `docs/data-model.md` → `prisma/schema.prisma` → `pnpm db:migrate` 순서. `db:push` 금지.
- 기술 선택 변경은 `docs/decisions/` 에 ADR 1개 (다음 번호는 **0008**).
- 테스트 실행 전 `pnpm db:up` 이 필요하다 (통합 테스트가 로컬 Postgres 를 쓴다).
- 모든 명령은 저장소 루트에서 `pnpm <script>` 로 실행한다.
- 완료 기준: `pnpm typecheck`, `pnpm lint`, `pnpm test` 통과.

---

### Task 1: 스키마 변경과 문서

`user` 에 3컬럼, `daily_result` 에 1컬럼을 추가한다. 이후 모든 태스크가 이 컬럼들에 의존하므로 가장 먼저 한다.

**Files:**
- Modify: `docs/data-model.md`
- Modify: `app/web/prisma/schema.prisma`
- Create: `app/web/prisma/migrations/<timestamp>_add_soft_delete_notify_prefs_and_seen_at/migration.sql` (`pnpm db:migrate` 가 생성)

**Interfaces:**
- Consumes: 없음
- Produces: `User.deletedAt: DateTime | null`, `User.notifySignal: boolean`, `User.notifySettlement: boolean`, `DailyResult.seenAt: DateTime | null`

- [ ] **Step 1: `docs/data-model.md` 의 user 표에 3줄 추가**

`## user (better-auth + username 플러그인)` 표의 마지막 행 뒤에 이어 붙인다:

```markdown
| deletedAt | timestamptz null | 소프트 삭제. 채워지면 로그인·검색·랭킹·친구 목록에서 제외한다. row 와 friendship 은 남긴다 |
| notifySignal | boolean not null default true | 퇴근 신호 푸시 수신 여부 (F2) |
| notifySettlement | boolean not null default true | 정산 결과 푸시 수신 여부 (F3) |
```

그 표 바로 아래에 다음 문단을 넣는다:

```markdown
`deletedAt` 은 조회 시점에 거른다. 필터를 빠뜨려 탈퇴 유저가 유령으로 남는 것을 막기 위해
조건을 `src/lib/db/active-user.ts` 의 `ACTIVE_USER` 상수 하나로 모으고, 이를 쓰는 네 지점
(친구 검색·친구 목록·레이스 랭킹·세션 검증)에 각각 회귀 테스트를 둔다. 아이디는 탈퇴 후에도
unique 제약이 살아 있어 재사용할 수 없다.
```

- [ ] **Step 2: `docs/data-model.md` 의 daily_result 표에 1줄 추가**

`## daily_result — 정산 스냅샷` 표에 이어 붙인다:

```markdown
| seenAt | timestamptz null | 사용자가 이 결과를 본 시각. 앱 진입 다이얼로그를 한 번만 띄우는 기준 |
```

- [ ] **Step 3: `schema.prisma` 의 `model User` 수정**

`displayUsername String?` 줄 바로 다음에 추가한다:

```prisma
  // 소프트 삭제 (2026-09-20). 조회 필터는 src/lib/db/active-user.ts 의 ACTIVE_USER 하나로 모은다
  deletedAt        DateTime?
  // 알림 수신 설정 (/my/profile). 인앱 토스트·진입 다이얼로그는 이 설정과 무관하다
  notifySignal     Boolean   @default(true)
  notifySettlement Boolean   @default(true)
```

- [ ] **Step 4: `schema.prisma` 의 `model DailyResult` 수정**

`settledAt DateTime @default(now())` 줄 다음에 추가한다:

```prisma
  /// 사용자가 결과를 본 시각. 앱 진입 다이얼로그를 한 번만 띄운다
  seenAt         DateTime?
```

- [ ] **Step 5: 마이그레이션 생성·적용**

```bash
pnpm db:up
pnpm db:migrate
```

프롬프트에 마이그레이션 이름을 물으면 `add_soft_delete_notify_prefs_and_seen_at` 을 입력한다.

- [ ] **Step 6: 타입 생성 확인**

```bash
pnpm typecheck
```

기대: 통과. (`pnpm db:migrate` 가 `prisma generate` 까지 수행한다. 안 됐으면 `pnpm --filter web exec prisma generate` 를 실행한다.)

- [ ] **Step 7: 커밋**

```bash
git add docs/data-model.md app/web/prisma/schema.prisma app/web/prisma/migrations
git commit -m "Add soft-delete, notification prefs and result seen timestamp"
```

---

### Task 2: 활성 유저 필터 도입

소프트 삭제 필터를 상수 하나로 모으고, 유저를 조회하는 네 지점에 적용한다. `deletedAt` 을 채우는 화면은 아직 없지만, 필터가 먼저 들어가야 뒤 태스크에서 탈퇴를 켤 때 유령 유저가 생기지 않는다.

**Files:**
- Create: `app/web/src/lib/db/active-user.ts`
- Modify: `app/web/src/features/friends/server/friends.ts` (`listFriends`, `searchUser`)
- Modify: `app/web/src/features/friends/server/list-friend-ids.ts`
- Modify: `app/web/src/features/race/server/today.ts`
- Modify: `app/web/src/lib/auth/current-user.ts`
- Create: `app/web/src/lib/db/active-user.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `User.deletedAt`
- Produces: `ACTIVE_USER: { deletedAt: null }` from `@/lib/db/active-user`

- [ ] **Step 1: `active-user.ts` 생성**

```ts
/**
 * 탈퇴하지 않은 유저만 고르는 조건 (소프트 삭제, docs/data-model.md).
 *
 * 필터를 여기 한 곳에 모으는 이유: 유저를 조회하는 곳마다 `deletedAt: null` 을 손으로
 * 적으면 한 군데만 빠뜨려도 탈퇴 유저가 랭킹·검색에 유령으로 남고, 그걸 아무도 눈치채지
 * 못한다. 이 상수를 쓰는 지점은 네 곳이며 각각 회귀 테스트가 붙어 있다:
 * 친구 검색·친구 목록(listFriendIds)·레이스 랭킹·세션 검증.
 */
export const ACTIVE_USER = { deletedAt: null } as const;
```

- [ ] **Step 2: `friends.ts` 의 `listFriends` 와 `searchUser` 에 적용**

파일 상단 import 에 추가:

```ts
import { ACTIVE_USER } from "@/lib/db/active-user";
```

`listFriends` 의 `where` 를 고친다:

```ts
    where: { id: { in: ids }, ...ACTIVE_USER },
```

`searchUser` 는 `findUnique` 가 unique 필드 외의 조건을 받지 못하므로 `findFirst` 로 바꾼다:

```ts
  const user = await prisma.user.findFirst({ where: { username, ...ACTIVE_USER }, select: USER_FIELDS });
```

- [ ] **Step 3: `list-friend-ids.ts` 에 적용**

`import { prisma } from "@/lib/db";` 다음 줄에 추가:

```ts
import { ACTIVE_USER } from "@/lib/db/active-user";
```

`where` 를 고친다 — 관계의 상대편이 살아 있어야 한다:

```ts
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addressee: ACTIVE_USER },
        { addresseeId: userId, requester: ACTIVE_USER },
      ],
    },
```

- [ ] **Step 4: `race/server/today.ts` 에 적용**

import 에 추가:

```ts
import { ACTIVE_USER } from "@/lib/db/active-user";
```

`db.user.findMany` 의 `where` 를 고친다:

```ts
    where: { id: { in: [user.id, ...friendIds] }, ...ACTIVE_USER },
```

- [ ] **Step 5: `current-user.ts` 의 `getCurrentUser` 에 적용**

세션이 있어도 탈퇴한 유저면 세션 없음으로 취급한다. 파일 전체를 다음으로 바꾼다:

```ts
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; username: string };

/** route handler 는 request.headers, 서버 컴포넌트는 await headers() 를 넘긴다 */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  // 탈퇴한 계정은 세션이 살아 있어도 로그인 상태가 아니다 (소프트 삭제).
  // better-auth 는 세션 조회 시 deletedAt 을 보지 않으므로 여기서 한 번 더 확인한다.
  const active = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!active) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
  };
}

/** 서버 컴포넌트(페이지)용. 세션이 없으면 /login 으로 보낸다 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  return user;
}
```

- [ ] **Step 6: 회귀 테스트 작성**

`app/web/src/lib/db/active-user.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listFriends, searchUser } from "@/features/friends/server/friends";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { getRaceToday } from "@/features/race/server/today";
import { createTestUser, deleteTestUsers } from "../../../test/db";

let me: { id: string; name: string; username: string };
let gone: { id: string; name: string; username: string };

beforeAll(async () => {
  [me, gone] = await Promise.all([createTestUser("active"), createTestUser("gone")]);
  await prisma.friendship.create({
    data: { requesterId: me.id, addresseeId: gone.id, status: "accepted" },
  });
  await prisma.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
});
afterAll(async () => {
  await deleteTestUsers([me.id, gone.id]);
});

describe("ACTIVE_USER filter", () => {
  it("hides a deleted user from friend search", async () => {
    expect(await searchUser(gone.username, me.id)).toBeNull();
  });

  it("hides a deleted user from the friend id list", async () => {
    expect(await listFriendIds(me.id)).not.toContain(gone.id);
  });

  it("hides a deleted user from the friend list", async () => {
    const friends = await listFriends(me.id);
    expect(friends.map((f) => f.userId)).not.toContain(gone.id);
  });

  it("hides a deleted user from the race ranking", async () => {
    const race = await getRaceToday({ id: me.id, name: me.name, username: me.username });
    expect(race.racers.map((r) => r.userId)).not.toContain(gone.id);
  });
});
```

- [ ] **Step 7: 테스트 실행**

```bash
pnpm db:up
pnpm test -- active-user
```

기대: 4개 모두 PASS.

- [ ] **Step 8: 전체 검증과 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add app/web/src/lib/db/active-user.ts app/web/src/lib/db/active-user.test.ts app/web/src/lib/auth/current-user.ts app/web/src/features/friends/server/friends.ts app/web/src/features/friends/server/list-friend-ids.ts app/web/src/features/race/server/today.ts
git commit -m "Filter out soft-deleted users everywhere they could appear"
```

---

### Task 3: 날짜를 받는 정산 함수

크론이 "어제" 를 정산하려면 `settleToday` 가 날짜를 인자로 받아야 한다. 지금은 내부에서 `kstDate(now)` 로 오늘을 계산한다.

**Files:**
- Modify: `app/web/src/features/titles/server/settle.ts`
- Modify: `app/web/src/features/titles/server/settle.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 `settleToday`)
- Produces: `settleRun(user: CurrentUser, runDate: Date, now?: Date): Promise<SettleResult>` — `runDate` 는 `kstDate()` 가 만든 UTC 자정 `Date`. 기존 `settleToday(user, now)` 는 `settleRun(user, kstDate(now), now)` 로 위임하는 얇은 래퍼로 남긴다.

- [ ] **Step 1: `settle.ts` 의 시그니처 변경**

`export async function settleToday(...)` 선언부와 첫 줄을 다음으로 교체한다. 위의 JSDoc 블록은 그대로 두고, 아래 두 함수로 나눈다:

```ts
export async function settleToday(user: CurrentUser, now: Date = new Date()): Promise<SettleResult> {
  return settleRun(user, kstDate(now), now);
}

/**
 * 특정 날짜(KST)의 정산. 자정 크론은 어제 날짜로, 화면은 오늘 날짜로 부른다.
 * `runDate` 는 `kstDate()` 가 만든 UTC 자정 Date 여야 한다 (`@db.Date` 컬럼 값).
 */
export async function settleRun(
  user: CurrentUser,
  runDate: Date,
  now: Date = new Date(),
): Promise<SettleResult> {
  return prisma.$transaction(async (tx) => {
```

그리고 기존 본문에서 `const runDate = kstDate(now);` 한 줄을 **삭제**한다 (인자로 받으므로).

- [ ] **Step 2: 랭킹 조회가 정산 날짜를 보게 한다**

본문 안의 `const race = await getRaceToday(user, now, tx);` 는 `now` 로 오늘 랭킹을 읽는다. 크론은 자정 이후에 어제를 정산하므로 그대로 두면 "오늘(=아직 0회)" 랭킹이 저장된다. 다음으로 바꾼다:

```ts
    // 랭킹은 정산 대상 날짜 기준이어야 한다. 크론은 자정을 넘긴 뒤 어제를 정산하므로
    // `now` 를 그대로 넘기면 아직 아무도 누르지 않은 오늘 랭킹이 저장된다.
    const race = await getRaceToday(user, runDate, tx);
```

`getRaceToday` 는 내부에서 `kstDate(now)` 를 부르는데, `runDate` 는 이미 해당 KST 날짜의 UTC 자정이라 `kstDate` 를 다시 통과해도 같은 값이 나온다 (`2026-09-19T00:00:00Z` → KST 09:00 → `2026-09-19`).

- [ ] **Step 3: `settle.test.ts` 에 날짜 지정 정산 테스트 추가**

파일 상단 import 를 고친다:

```ts
import { settleRun, settleToday } from "./settle";
```

`describe("settleToday", ...)` 블록의 마지막 `it` 뒤에 추가한다:

```ts
  it("settles a given date and ranks by that date's taps", async () => {
    const other = await createTestUser("settleday");
    try {
      const user = { id: other.id, name: other.name, username: other.username };
      await recordTaps(other.id, 1200, MORNING);
      // 자정을 넘긴 시각에 어제(MORNING 이 속한 날) 를 정산한다
      const afterMidnight = new Date("2026-09-19T16:00:00Z"); // 09-20 01:00 KST
      const r = await settleRun(user, kstDate(MORNING), afterMidnight);
      expect(r.alreadySettled).toBe(false);
      expect(r.rankTotal).toBe(1);

      const saved = await prisma.dailyResult.findFirstOrThrow({
        where: { dailyRun: { userId: other.id, runDate: kstDate(MORNING) } },
      });
      expect(saved.rank).toBe(1);
    } finally {
      await deleteTestUsers([other.id]);
    }
  });
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm test -- settle
```

기대: 기존 테스트 전부 PASS + 새 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/web/src/features/titles/server/settle.ts app/web/src/features/titles/server/settle.test.ts
git commit -m "Let settlement target a specific run date"
```

---

### Task 4: 정산 배치와 크론 엔드포인트

어제 탭이 있는 유저를 찾아 순차 정산한다. 푸시는 다음 태스크에서 붙인다.

**Files:**
- Create: `app/web/src/features/titles/server/settle-batch.ts`
- Create: `app/web/src/app/api/cron/settle/route.ts`
- Create: `app/web/src/features/titles/server/settle-batch.test.ts`
- Modify: `vercel.json`
- Modify: `app/web/.env.example`

**Interfaces:**
- Consumes: Task 3 의 `settleRun(user, runDate, now)`
- Produces:
  - `yesterdayKstDate(now?: Date): Date` from `@/lib/kst`
  - `settleAllForDate(runDate: Date, now?: Date): Promise<BatchReport>` where `BatchReport = { runDate: string; targeted: number; settled: number; failed: string[] }`

- [ ] **Step 1: `kst.ts` 에 어제 날짜 헬퍼 추가**

`app/web/src/lib/kst.ts` 의 `kstDate` 함수 바로 다음에 추가한다:

```ts
/** 어제의 KST 날짜를 `@db.Date` 값으로. 자정 직후 크론이 "어제" 를 정산할 때 쓴다 */
export function yesterdayKstDate(now: Date = new Date()): Date {
  const today = kstDate(now);
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 2: `kst.test.ts` 에 테스트 추가**

`app/web/src/lib/kst.test.ts` 의 맨 아래에 추가한다 (파일 상단 import 에 `yesterdayKstDate` 를 더한다):

```ts
describe("yesterdayKstDate", () => {
  it("returns the previous KST day at UTC midnight", () => {
    // 2026-09-20 00:05 KST = 2026-09-19 15:05 UTC
    const at = new Date("2026-09-19T15:05:00Z");
    expect(yesterdayKstDate(at).toISOString()).toBe("2026-09-19T00:00:00.000Z");
  });

  it("does not cross a month boundary incorrectly", () => {
    const at = new Date("2026-09-30T15:05:00Z"); // 10-01 00:05 KST
    expect(yesterdayKstDate(at).toISOString()).toBe("2026-09-30T00:00:00.000Z");
  });
});
```

기존 파일에 `describe`/`it`/`expect` import 가 이미 있으면 그대로 쓴다.

- [ ] **Step 3: `settle-batch.ts` 작성**

```ts
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
```

- [ ] **Step 4: 크론 라우트 작성**

`app/web/src/app/api/cron/settle/route.ts`:

```ts
import { settleAllForDate } from "@/features/titles/server/settle-batch";
import { jsonError } from "@/lib/api";
import { yesterdayKstDate } from "@/lib/kst";

/** 배치가 길어질 수 있어 정적 최적화를 막고 매번 실행되게 한다 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 자정 자동 정산 (ADR 0008). Vercel Cron 이 매일 KST 00:05 에 부른다.
 *
 * 공개 URL 이므로 CRON_SECRET 없이는 아무것도 하지 않는다. Vercel Cron 은
 * `Authorization: Bearer $CRON_SECRET` 을 자동으로 실어 보낸다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError(500, "CRON_SECRET 이 설정되지 않았어요");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError(401, "권한이 없어요");
  }

  const report = await settleAllForDate(yesterdayKstDate());
  return Response.json(report);
}
```

`jsonError` 의 시그니처는 `src/lib/api.ts` 에서 확인한다 — 다른 라우트가 `jsonError(401, "로그인이 필요해요")` 형태로 쓰고 있다.

- [ ] **Step 5: 배치 테스트 작성**

`app/web/src/features/titles/server/settle-batch.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { settleAllForDate } from "./settle-batch";

const YESTERDAY = new Date("2026-09-19T08:30:00Z"); // 17:30 KST 09-19
const AFTER_MIDNIGHT = new Date("2026-09-19T15:05:00Z"); // 00:05 KST 09-20
const RUN_DATE = kstDate(YESTERDAY);

let tapped: { id: string };
let idle: { id: string };

beforeAll(async () => {
  [tapped, idle] = await Promise.all([createTestUser("btap"), createTestUser("bidle")]);
  await recordTaps(tapped.id, 1200, YESTERDAY);
  // idle 은 run 행만 있고 탭이 0인 상태를 만든다
  await prisma.dailyRun.create({ data: { userId: idle.id, runDate: RUN_DATE } });
});
afterAll(async () => {
  await deleteTestUsers([tapped.id, idle.id]);
});

describe("settleAllForDate", () => {
  it("settles users who tapped and skips users who did not", async () => {
    const report = await settleAllForDate(RUN_DATE, AFTER_MIDNIGHT);
    expect(report.runDate).toBe("2026-09-19");
    expect(report.failed).toEqual([]);

    const settled = await prisma.dailyResult.findFirst({
      where: { dailyRun: { userId: tapped.id, runDate: RUN_DATE } },
    });
    expect(settled).not.toBeNull();

    const skipped = await prisma.dailyResult.findFirst({
      where: { dailyRun: { userId: idle.id, runDate: RUN_DATE } },
    });
    expect(skipped).toBeNull();
  });

  it("is safe to run twice", async () => {
    const again = await settleAllForDate(RUN_DATE, AFTER_MIDNIGHT);
    // 이미 정산된 run 은 대상에서 빠진다
    expect(again.targeted).toBe(0);
    expect(again.settled).toBe(0);

    const rows = await prisma.dailyResult.count({
      where: { dailyRun: { userId: tapped.id, runDate: RUN_DATE } },
    });
    expect(rows).toBe(1);
  });
});
```

테스트 DB 가 다른 테스트의 유저와 섞이므로 `targeted` 숫자 자체는 단정하지 않는다 — 두 번째 테스트의 `targeted: 0` 은 첫 테스트가 같은 날짜의 대상을 모두 소진한 뒤이므로 안전하다. 만약 이 단정이 불안정하면 `expect(again.settled).toBe(0)` 만 남긴다.

- [ ] **Step 6: 테스트 실행**

```bash
pnpm test -- settle-batch
pnpm test -- kst
```

기대: 모두 PASS.

- [ ] **Step 7: `vercel.json` 에 크론 등록**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["icn1"],
  "crons": [
    {
      "path": "/api/cron/settle",
      "schedule": "5 15 * * *"
    }
  ]
}
```

`5 15 * * *` 은 UTC 15:05 = KST 00:05 이다. Vercel 크론은 UTC 로만 해석한다.

- [ ] **Step 8: `.env.example` 에 변수 추가**

`app/web/.env.example` 맨 아래에 추가한다:

```bash
# 자정 자동 정산 크론 인증 (ADR 0008). Vercel 이 Bearer 로 실어 보낸다.
# 로컬에서 수동 호출: curl -H "Authorization: Bearer dev-cron-secret" localhost:3000/api/cron/settle
CRON_SECRET=dev-cron-secret
```

- [ ] **Step 9: 로컬 수동 확인**

```bash
pnpm dev
```

다른 터미널에서:

```bash
curl -i localhost:3000/api/cron/settle
curl -i -H "Authorization: Bearer dev-cron-secret" localhost:3000/api/cron/settle
```

기대: 첫 번째는 401, 두 번째는 200 과 `{"runDate":"...","targeted":N,"settled":N,"failed":[]}`.
(`.env` 에 `CRON_SECRET` 을 넣어 둬야 한다.)

- [ ] **Step 10: 커밋**

```bash
git add app/web/src/features/titles/server/settle-batch.ts app/web/src/features/titles/server/settle-batch.test.ts app/web/src/app/api/cron/settle/route.ts app/web/src/lib/kst.ts app/web/src/lib/kst.test.ts vercel.json app/web/.env.example
git commit -m "Settle yesterday's runs from a midnight cron"
```

---

### Task 5: 정산 결과 푸시

정산에 성공한 유저에게 알림 1건. 배치 안에서 보낸다.

**Files:**
- Create: `app/web/src/features/titles/messages.ts`
- Create: `app/web/src/features/push/server/send-settlement-push.ts`
- Modify: `app/web/src/features/titles/server/settle-batch.ts`
- Create: `app/web/src/features/titles/messages.test.ts`
- Modify: `app/web/src/features/push/server/send-signal-push.ts`

**Interfaces:**
- Consumes: Task 4 의 `settleAllForDate`, 기존 `sendToToken(token, message)` / `listPushTokens(userIds)` / `dropPushTokens(tokens)`, `TITLE_BY_ID`
- Produces:
  - `settlementMessage(primaryTitleId: TitleId | null, total: number): { title: string; body: string }`
  - `sendSettlementPush(items: SettlementPushItem[], ymd: string): Promise<void>` where `SettlementPushItem = { userId: string; primaryTitleId: TitleId | null; total: number }`

- [ ] **Step 1: 알림 문구 모듈 작성**

`app/web/src/features/titles/messages.ts`:

```ts
import { TITLE_BY_ID, type TitleId } from "./catalog";

/**
 * 자정 정산 알림 문구. 인앱 다이얼로그와 같은 사실만 말한다 —
 * 대표 칭호가 있으면 칭호를, 없으면 횟수를 앞세운다.
 */
export function settlementMessage(
  primaryTitleId: TitleId | null,
  total: number,
): { title: string; body: string } {
  const count = total.toLocaleString("ko-KR");
  if (primaryTitleId) {
    return {
      title: "어제의 칭호가 나왔어요",
      body: `어제 당신은 '${TITLE_BY_ID[primaryTitleId].name}'`,
    };
  }
  return {
    title: "어제의 기록이 정리됐어요",
    body: `어제 ${count}번 퇴근하고 싶었어요`,
  };
}
```

- [ ] **Step 2: 문구 테스트 작성**

`app/web/src/features/titles/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { settlementMessage } from "./messages";

describe("settlementMessage", () => {
  it("leads with the primary title when there is one", () => {
    const msg = settlementMessage("heart_already_home", 10000);
    expect(msg.body).toContain("마음만 이미 집에 있음");
  });

  it("falls back to the tap count with a thousands separator", () => {
    const msg = settlementMessage(null, 1204);
    expect(msg.body).toBe("어제 1,204번 퇴근하고 싶었어요");
  });
});
```

칭호 이름은 `src/features/titles/catalog.ts` 에서 `heart_already_home` 의 실제 `name` 을 확인해 맞춘다.

- [ ] **Step 3: 푸시 발송 모듈 작성**

`app/web/src/features/push/server/send-settlement-push.ts`:

```ts
import "server-only";
import { settlementMessage } from "@/features/titles/messages";
import type { TitleId } from "@/features/titles/catalog";
import { prisma } from "@/lib/db";
import { isPushConfigured, sendToToken } from "./fcm";
import { dropPushTokens, listPushTokens } from "./tokens";

export type SettlementPushItem = {
  userId: string;
  primaryTitleId: TitleId | null;
  total: number;
};

/**
 * 자정 정산 알림 (ADR 0008). 정산된 유저마다 한 건.
 *
 * `notifySettlement` 를 끈 유저는 건너뛴다. 알림을 못 받아도 결과는 앱 진입 다이얼로그가
 * 전달하므로(Task 7) 여기서 실패해도 사용자가 결과를 놓치지는 않는다. 그래서 실패는
 * 로그만 남긴다.
 *
 * 알림을 탭하면 그 날짜의 기록 상세로 연다.
 */
export async function sendSettlementPush(items: SettlementPushItem[], ymd: string): Promise<void> {
  if (items.length === 0 || !isPushConfigured()) return;

  const optedIn = await prisma.user.findMany({
    where: { id: { in: items.map((i) => i.userId) }, notifySettlement: true, deletedAt: null },
    select: { id: true },
  });
  const allowed = new Set(optedIn.map((u) => u.id));
  const targets = items.filter((i) => allowed.has(i.userId));
  if (targets.length === 0) return;

  const tokensByUser = await listPushTokens(targets.map((i) => i.userId));
  if (tokensByUser.size === 0) return;

  const dead: string[] = [];
  for (const item of targets) {
    const tokens = tokensByUser.get(item.userId);
    if (!tokens) continue;
    const { title, body } = settlementMessage(item.primaryTitleId, item.total);
    await Promise.all(
      tokens.map(async (token) => {
        const outcome = await sendToToken(token, { title, body, path: `/records/${ymd}` });
        if (outcome === "unregistered") dead.push(token);
      }),
    );
  }

  await dropPushTokens(dead);
}
```

- [ ] **Step 4: 신호 푸시도 설정을 따르게 한다**

`send-signal-push.ts` 의 `const receiverIds = [...new Set(pending.map((s) => s.receiverId))];` 다음 두 줄을 교체한다:

```ts
  const receiverIds = [...new Set(pending.map((s) => s.receiverId))];
  // 알림을 끈 사람에게는 보내지 않는다 (/my/profile). 인앱 토스트는 이 설정과 무관하다
  const optedIn = await prisma.user.findMany({
    where: { id: { in: receiverIds }, notifySignal: true, deletedAt: null },
    select: { id: true },
  });
  if (optedIn.length === 0) return;

  const tokensByUser = await listPushTokens(optedIn.map((u) => u.id));
```

(기존의 `const tokensByUser = await listPushTokens(receiverIds);` 줄은 위 마지막 줄로 대체된다.)

- [ ] **Step 5: 배치에 푸시 연결**

`settle-batch.ts` 상단 import 에 추가:

```ts
import { sendSettlementPush, type SettlementPushItem } from "@/features/push/server/send-settlement-push";
```

`settleAllForDate` 안에서, `const report: BatchReport = {...}` 선언 다음에 추가:

```ts
  const pushes: SettlementPushItem[] = [];
```

청크 처리의 `chunk.map(async (run) => {...})` 안 `try` 블록을 다음으로 바꾼다:

```ts
        try {
          const result = await settleRun(
            { id: run.user.id, name: run.user.name, username: run.user.username ?? "" },
            runDate,
            now,
          );
          return {
            id: run.id,
            ok: true,
            push: {
              userId: run.user.id,
              primaryTitleId: result.primaryTitleId,
              total: run.tapCount,
            } satisfies SettlementPushItem,
          };
        } catch (error) {
          console.error(`[settle-batch] failed for run ${run.id}`, error);
          return { id: run.id, ok: false, push: null };
        }
```

이를 위해 `findMany` 의 `select` 에 `tapCount: true` 를 추가한다:

```ts
    select: { id: true, tapCount: true, user: { select: { id: true, name: true, username: true } } },
```

결과 집계 루프를 다음으로 바꾼다:

```ts
    for (const outcome of outcomes) {
      if (outcome.ok) {
        report.settled += 1;
        if (outcome.push) pushes.push(outcome.push);
      } else {
        report.failed.push(outcome.id);
      }
    }
```

`return report;` 앞에 추가한다:

```ts
  // 푸시는 정산이 전부 끝난 뒤에. 정산 트랜잭션이 네트워크 대기에 묶이면 안 된다
  await sendSettlementPush(pushes, report.runDate);
```

- [ ] **Step 6: 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

기대: 모두 통과. 푸시는 `isPushConfigured()` 가 false 인 테스트 환경에서 조용히 빠진다.

- [ ] **Step 7: 커밋**

```bash
git add app/web/src/features/titles/messages.ts app/web/src/features/titles/messages.test.ts app/web/src/features/push/server/send-settlement-push.ts app/web/src/features/push/server/send-signal-push.ts app/web/src/features/titles/server/settle-batch.ts
git commit -m "Notify users when their day is settled"
```

---

### Task 6: 기록 화면 `/records`

정산 결과를 날짜별로 본다. 이 화면이 생겨야 `/today` 를 지울 수 있다.

**Files:**
- Create: `app/web/src/features/titles/server/record-list.ts`
- Create: `app/web/src/app/(app)/records/page.tsx`
- Create: `app/web/src/app/(app)/records/[date]/page.tsx`
- Create: `app/web/src/features/titles/components/record-row.tsx`
- Create: `app/web/src/features/titles/server/record-list.test.ts`

**Interfaces:**
- Consumes: 기존 `getTodaySummary(user, now)`, `TodayResultCard`, `TitleBadge`, `TITLE_BY_ID`, `kstDateLabel`, `runDateToYmd`
- Produces:
  - `RecordSummary = { date: string; total: number; primaryTitleId: TitleId | null; titleCount: number; hasNew: boolean; rank: number; rankTotal: number }`
  - `listRecords(userId: string, now?: Date): Promise<RecordSummary[]>` — 최근 30일, 최신순, 정산된 날만
  - `getRecordDetail(user: CurrentUser, ymd: string): Promise<TodaySummary | null>` — 정산되지 않았거나 없는 날이면 null

- [ ] **Step 1: `record-list.ts` 작성**

```ts
import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate, kstTimeLabel, runDateToYmd } from "@/lib/kst";
import { isTitleId, type TitleId } from "../catalog";
import { peakHour } from "../evaluate";
import type { TodaySummary } from "./today-summary";

export type RecordSummary = {
  /** "YYYY-MM-DD" */
  date: string;
  total: number;
  primaryTitleId: TitleId | null;
  titleCount: number;
  /** 그날 처음 얻은 칭호가 있었는지 (목록의 NEW 배지) */
  hasNew: boolean;
  rank: number;
  rankTotal: number;
};

/** 페이지네이션 없이 최근 30일만 본다. 더 필요해지면 그때 커서를 붙인다 */
const WINDOW_DAYS = 30;

/** 정산이 끝난 날들. 최신순 */
export async function listRecords(userId: string, now: Date = new Date()): Promise<RecordSummary[]> {
  const since = new Date(kstDate(now).getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const runs = await prisma.dailyRun.findMany({
    where: { userId, runDate: { gte: since }, result: { isNot: null } },
    select: { runDate: true, tapCount: true, result: true },
    orderBy: { runDate: "desc" },
  });

  const newRows = await prisma.userTitle.findMany({
    where: { userId, firstEarnedOn: { gte: since } },
    select: { firstEarnedOn: true },
  });
  const newDates = new Set(newRows.map((r) => runDateToYmd(r.firstEarnedOn)));

  return runs.map((run) => {
    const date = runDateToYmd(run.runDate);
    const primary = run.result?.primaryTitleId;
    return {
      date,
      total: run.tapCount,
      primaryTitleId: primary && isTitleId(primary) ? primary : null,
      titleCount: run.result?.titleIds.filter(isTitleId).length ?? 0,
      hasNew: newDates.has(date),
      rank: run.result?.rank ?? 0,
      rankTotal: run.result?.rankTotal ?? 0,
    };
  });
}

/**
 * 지난 날 하나의 상세. 화면 모양이 오늘 카드와 같아 `TodaySummary` 를 그대로 돌려준다.
 * 상세를 열면 결과를 본 것으로 간주해 `seenAt` 을 채운다 — 진입 다이얼로그가 다시 뜨지
 * 않게 한다 (푸시를 탭해 바로 들어온 경우가 이 경로다).
 */
export async function getRecordDetail(user: CurrentUser, ymd: string): Promise<TodaySummary | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const runDate = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(runDate.getTime())) return null;

  const run = await prisma.dailyRun.findUnique({
    where: { userId_runDate: { userId: user.id, runDate } },
    include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
  });
  if (!run?.result) return null;

  const titleIds = run.result.titleIds.filter(isTitleId);
  const newRows = await prisma.userTitle.findMany({
    where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
    select: { titleId: true },
  });

  if (!run.result.seenAt) {
    await prisma.dailyResult.update({ where: { dailyRunId: run.id }, data: { seenAt: new Date() } });
  }

  return {
    date: ymd,
    total: run.tapCount,
    firstTapAt: run.firstTapAt ? kstTimeLabel(run.firstTapAt) : null,
    peakHour: peakHour(run.tapEvents),
    rank: run.result.rank,
    rankTotal: run.result.rankTotal,
    result: {
      primaryTitleId:
        run.result.primaryTitleId && isTitleId(run.result.primaryTitleId)
          ? run.result.primaryTitleId
          : null,
      titleIds,
      newTitleIds: newRows.map((r) => r.titleId).filter(isTitleId),
    },
  };
}
```

- [ ] **Step 2: `record-row.tsx` 작성**

```tsx
import Link from "next/link";
import { Stickman } from "@/components/stickman";
import { TITLE_BY_ID } from "../catalog";
import type { RecordSummary } from "../server/record-list";

/** 기록 목록의 한 줄. 누르면 그날 상세로 */
export function RecordRow({ record }: { record: RecordSummary }) {
  const primary = record.primaryTitleId ? TITLE_BY_ID[record.primaryTitleId] : null;
  const [, month, day] = record.date.split("-");

  return (
    <Link
      href={`/records/${record.date}`}
      className="flex items-center gap-3 border-b-[1.5px] border-dashed border-pencil-soft py-3"
    >
      <Stickman pose={primary?.pose ?? "stand"} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-ui text-xl font-bold">
            {Number(month)}월 {Number(day)}일
          </span>
          {record.hasNew && (
            <span className="font-ui text-sm font-bold text-margin">NEW</span>
          )}
        </span>
        <span className="block truncate font-note text-lg text-pencil">
          {primary ? primary.name : "칭호 없음"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular block font-ui text-xl font-bold">
          {record.total.toLocaleString("ko-KR")}번
        </span>
        <span className="tabular block font-note text-base text-pencil-soft">
          {record.rank}위 / {record.rankTotal}명
        </span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: 목록 페이지 작성**

`app/web/src/app/(app)/records/page.tsx`:

```tsx
import { Note, ScreenTitle } from "@/components/paper";
import { RecordRow } from "@/features/titles/components/record-row";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { listRecords } from "@/features/titles/server/record-list";
import { getTodaySummary } from "@/features/titles/server/today-summary";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function RecordsPage() {
  const user = await requirePageUser();
  const [today, records] = await Promise.all([getTodaySummary(user), listRecords(user.id)]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>퇴근 기록</ScreenTitle>
      <Note>{kstDateLabel(today.date)} · 진행 중</Note>

      <TodayResultCard summary={today} />
      <Note className="mt-2 text-center">자정이 지나면 자동으로 정산돼요</Note>

      <h2 className="mt-7 font-ui text-xl font-bold">지난 기록</h2>
      {records.length === 0 ? (
        <Note className="mt-2">아직 정산된 날이 없어요. 오늘 밤이 첫 기록이 돼요</Note>
      ) : (
        <div className="mt-1">
          {records.map((record) => (
            <RecordRow key={record.date} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 상세 페이지 작성**

`app/web/src/app/(app)/records/[date]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { TITLE_BY_ID } from "@/features/titles/catalog";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { getRecordDetail } from "@/features/titles/server/record-list";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function RecordDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const user = await requirePageUser();
  const summary = await getRecordDetail(user, date);
  if (!summary?.result) notFound();

  const { result } = summary;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>그날의 기록</ScreenTitle>
      <Note>{kstDateLabel(summary.date)} · 정산 완료</Note>

      <TodayResultCard summary={summary} />

      <div className="mt-4 flex items-baseline justify-between text-xl font-bold">
        <span>이날 얻은 칭호</span>
        <span className="tabular">{result.titleIds.length}개</span>
      </div>
      {result.titleIds.length === 0 ? (
        <Note className="mt-2">이날은 조건에 맞는 칭호가 없었어요</Note>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {result.titleIds.map((id) => (
            <TitleBadge
              key={id}
              name={TITLE_BY_ID[id].name}
              pose={TITLE_BY_ID[id].pose}
              isNew={result.newTitleIds.includes(id)}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Link
          href="/my/collection"
          className="mk mk-pill block px-4 py-2.5 text-center font-ui text-xl font-bold text-ink"
        >
          도감 전체 보기
        </Link>
        <Link href="/records" className="text-center font-note text-lg text-pencil-soft underline underline-offset-4">
          기록 목록으로
        </Link>
      </div>
    </div>
  );
}
```

Next.js 16 에서 `params` 는 Promise 다 — 반드시 `await` 한다.

- [ ] **Step 5: 테스트 작성**

`app/web/src/features/titles/server/record-list.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { settleRun } from "./settle";
import { getRecordDetail, listRecords } from "./record-list";

const DAY = new Date("2026-09-18T08:30:00Z"); // 17:30 KST 09-18
const NOW = new Date("2026-09-20T03:00:00Z"); // 12:00 KST 09-20
let me: { id: string; name: string; username: string };

beforeAll(async () => {
  me = await createTestUser("rec");
  await recordTaps(me.id, 1200, DAY);
  await settleRun({ id: me.id, name: me.name, username: me.username }, kstDate(DAY), NOW);
});
afterAll(async () => {
  await deleteTestUsers([me.id]);
});

describe("listRecords", () => {
  it("returns settled days newest first", async () => {
    const records = await listRecords(me.id, NOW);
    expect(records[0]).toMatchObject({ date: "2026-09-18", total: 1200, rank: 1 });
    expect(records[0].hasNew).toBe(true);
  });
});

describe("getRecordDetail", () => {
  it("returns the day's summary and marks it seen", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    const detail = await getRecordDetail(user, "2026-09-18");
    expect(detail?.total).toBe(1200);
    expect(detail?.result).not.toBeNull();

    const saved = await prisma.dailyResult.findFirstOrThrow({
      where: { dailyRun: { userId: me.id, runDate: kstDate(DAY) } },
    });
    expect(saved.seenAt).not.toBeNull();
  });

  it("returns null for an unsettled or malformed date", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    expect(await getRecordDetail(user, "2026-01-01")).toBeNull();
    expect(await getRecordDetail(user, "not-a-date")).toBeNull();
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
pnpm test -- record-list
```

기대: 모두 PASS.

- [ ] **Step 7: 화면 확인**

```bash
pnpm dev
```

브라우저에서 `/records` 와 `/records/2026-09-18` 을 연다. 목록에 줄이 보이고, 상세로 이동하며, 없는 날짜는 404 가 뜬다.

- [ ] **Step 8: 커밋**

```bash
git add app/web/src/features/titles/server/record-list.ts app/web/src/features/titles/server/record-list.test.ts app/web/src/features/titles/components/record-row.tsx "app/web/src/app/(app)/records"
git commit -m "Show settled days as a record list with detail pages"
```

---

### Task 7: 정산 결과 진입 다이얼로그

푸시를 못 받는 경로(브라우저·알림 거부)에서도 결과가 닿게 한다.

**Files:**
- Create: `app/web/src/features/titles/server/unseen-result.ts`
- Create: `app/web/src/features/titles/actions.ts` (기존 파일을 **교체**)
- Create: `app/web/src/features/titles/components/settlement-watcher.tsx`
- Modify: `app/web/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: Task 1 의 `DailyResult.seenAt`, 기존 `MarkerDialog`, `MarkerButton`, `Stickman`, `TITLE_BY_ID`
- Produces:
  - `UnseenResult = { date: string; primaryTitleId: TitleId | null; total: number; titleCount: number; rank: number; rankTotal: number }`
  - `getUnseenResult(userId: string): Promise<UnseenResult | null>`
  - `markResultsSeenAction(): Promise<void>` — 안 본 결과 전부를 본 것으로 표시하는 서버 액션

- [ ] **Step 1: `unseen-result.ts` 작성**

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { runDateToYmd } from "@/lib/kst";
import { isTitleId, type TitleId } from "../catalog";

export type UnseenResult = {
  /** "YYYY-MM-DD" */
  date: string;
  primaryTitleId: TitleId | null;
  total: number;
  titleCount: number;
  rank: number;
  rankTotal: number;
};

/**
 * 아직 보지 않은 정산 결과 중 가장 최근 한 건.
 *
 * 며칠 자리를 비워 여러 건이 쌓였어도 한 건만 띄운다 — 다이얼로그를 세 번 닫게 하는 것보다
 * 어제 결과를 보여주고 기록 목록을 가리키는 편이 낫다. 나머지는 닫을 때 함께 seen 처리한다
 * (`markResultsSeenAction`).
 */
export async function getUnseenResult(userId: string): Promise<UnseenResult | null> {
  const run = await prisma.dailyRun.findFirst({
    where: { userId, result: { is: { seenAt: null } } },
    select: { runDate: true, tapCount: true, result: true },
    orderBy: { runDate: "desc" },
  });
  if (!run?.result) return null;

  const primary = run.result.primaryTitleId;
  return {
    date: runDateToYmd(run.runDate),
    primaryTitleId: primary && isTitleId(primary) ? primary : null,
    total: run.tapCount,
    titleCount: run.result.titleIds.filter(isTitleId).length,
    rank: run.result.rank,
    rankTotal: run.result.rankTotal,
  };
}
```

- [ ] **Step 2: `actions.ts` 교체**

기존 `settleTodayAction` 은 수동 정산이 사라지면서 쓰이지 않는다. 파일 전체를 다음으로 바꾼다:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

/**
 * 진입 다이얼로그를 닫을 때 안 본 결과를 전부 본 것으로 표시한다.
 * 한 건만 보여주고 나머지를 남겨 두면 다음 진입에서 또 뜬다.
 */
export async function markResultsSeenAction(): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  await prisma.dailyResult.updateMany({
    where: { seenAt: null, dailyRun: { userId: user.id } },
    data: { seenAt: new Date() },
  });
}
```

- [ ] **Step 3: 다이얼로그 컴포넌트 작성**

`app/web/src/features/titles/components/settlement-watcher.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { Stickman } from "@/components/stickman";
import { kstDateLabel } from "@/lib/kst";
import { markResultsSeenAction } from "../actions";
import { TITLE_BY_ID } from "../catalog";
import type { UnseenResult } from "../server/unseen-result";

/**
 * 자정에 정산된 결과를 앱 진입 시 한 번 띄운다. 푸시를 못 받는 경로(브라우저 접속,
 * 알림 거부)에서도 결과가 닿아야 하기 때문이다.
 *
 * 친구 요청 다이얼로그(F0-3)와 자리가 겹치므로 이쪽이 먼저 뜬다 — 레이아웃에서 이
 * 컴포넌트를 FriendRequestWatcher 보다 앞에 둔다.
 */
export function SettlementWatcher({ result }: { result: UnseenResult | null }) {
  const router = useRouter();
  const [closed, setClosed] = useState(false);
  const [pending, startTransition] = useTransition();

  function close(then?: () => void) {
    setClosed(true);
    startTransition(async () => {
      await markResultsSeenAction();
      router.refresh();
      then?.();
    });
  }

  if (!result) return null;
  const primary = result.primaryTitleId ? TITLE_BY_ID[result.primaryTitleId] : null;

  return (
    <MarkerDialog
      open={!closed}
      onClose={() => close()}
      title="어제의 결과가 나왔어요"
      actions={
        <>
          <MarkerButton size="sm" variant="ghost" disabled={pending} onClick={() => close()}>
            닫기
          </MarkerButton>
          <MarkerButton
            size="sm"
            disabled={pending}
            onClick={() => close(() => router.push(`/records/${result.date}`))}
          >
            기록 보기
          </MarkerButton>
        </>
      }
    >
      <p className="font-note text-lg text-pencil">{kstDateLabel(result.date)}</p>
      <div className="mt-2 flex items-center gap-3">
        <Stickman pose={primary?.pose ?? "stand"} size={40} thick />
        <span className="min-w-0">
          <span className="block font-ui text-[22px] font-bold leading-tight text-balance">
            {primary ? primary.name : "칭호 없음"}
          </span>
          <span className="tabular block font-note text-lg text-pencil">
            {result.total.toLocaleString("ko-KR")}번 · {result.rank}위 / {result.rankTotal}명 · 칭호{" "}
            {result.titleCount}개
          </span>
        </span>
      </div>
    </MarkerDialog>
  );
}
```

- [ ] **Step 4: 레이아웃에 연결**

`app/web/src/app/(app)/layout.tsx` 의 import 에 추가:

```ts
import { SettlementWatcher } from "@/features/titles/components/settlement-watcher";
import { getUnseenResult } from "@/features/titles/server/unseen-result";
```

`const friends = await getFriendsState(user.id);` 를 다음으로 바꾼다:

```ts
  // 받은 요청은 어느 화면에서든 다이얼로그로 떠야 해서 레이아웃에서 한 번 읽는다 (F0-3).
  // 자정 정산 결과도 같은 이유로 여기서 읽는다 — 푸시를 못 받는 경로의 전달 통로다.
  const [friends, unseen] = await Promise.all([getFriendsState(user.id), getUnseenResult(user.id)]);
```

JSX 에서 `<FriendRequestWatcher />` **앞에** 추가한다:

```tsx
        <SettlementWatcher result={unseen} />
        <FriendRequestWatcher />
```

- [ ] **Step 5: 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 6: 화면 확인**

정산된 결과의 `seenAt` 을 수동으로 비운 뒤 앱을 새로고침한다:

```bash
pnpm --filter web exec prisma studio
```

또는 psql 로 `UPDATE daily_result SET "seenAt" = NULL;`. 앱 진입 시 다이얼로그가 뜨고, 닫으면 다시 뜨지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add app/web/src/features/titles/server/unseen-result.ts app/web/src/features/titles/actions.ts app/web/src/features/titles/components/settlement-watcher.tsx "app/web/src/app/(app)/layout.tsx"
git commit -m "Show yesterday's settlement on app entry"
```

---

### Task 8: 마이페이지 허브와 도감 이동

**Files:**
- Create: `app/web/src/app/(app)/my/page.tsx`
- Create: `app/web/src/features/auth/components/logout-row.tsx`
- Create: `app/web/src/app/(app)/my/collection/page.tsx`
- Delete: `app/web/src/app/(app)/collection/page.tsx`
- Delete: `app/web/src/features/auth/components/logout-button.tsx`

**Interfaces:**
- Consumes: 기존 `getCollection(userId, now)`, `signOut`, `useLiveSync().endSession`, `MarkerDialog`
- Produces: `LogoutRow` — 허브 목록 안에 놓이는 로그아웃 줄 (확인 다이얼로그 포함)

- [ ] **Step 1: `logout-row.tsx` 작성**

기존 `logout-button.tsx` 의 로직을 그대로 쓰되 목록 줄 모양으로 바꾼다:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { useLiveSync } from "@/features/realtime/live-sync-context";
import { signOut } from "@/lib/auth/client";

/**
 * 마이페이지의 로그아웃 줄 (F0-5). 연타 중 잘못 눌러 레이스가 끊기지 않도록
 * 확인 다이얼로그를 한 번 거친다.
 */
export function LogoutRow() {
  const router = useRouter();
  const { endSession } = useLiveSync();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setPending(true);
    try {
      await signOut();
      await endSession();
      setAsking(false);
      // replace: 뒤로 가기로 앱 화면에 돌아오지 못하게 한다.
      // refresh 로 서버 레이아웃이 세션을 다시 읽게 해 캐시된 화면도 비운다
      router.replace("/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex w-full items-center justify-between border-b-[1.5px] border-dashed border-pencil-soft py-3.5 text-left font-ui text-xl font-bold"
      >
        로그아웃
        <span className="font-note text-lg text-pencil-soft">→</span>
      </button>

      <MarkerDialog
        open={asking}
        onClose={() => setAsking(false)}
        title="로그아웃할까요?"
        actions={
          <>
            <MarkerButton variant="ghost" size="sm" onClick={() => setAsking(false)}>
              그만두기
            </MarkerButton>
            <MarkerButton size="sm" onClick={handleLogout} disabled={pending}>
              {pending ? "나가는 중…" : "로그아웃"}
            </MarkerButton>
          </>
        }
      >
        <p className="font-note text-lg text-pencil">
          다시 들어오려면 아이디와 비밀번호가 필요해요.
        </p>
        {error && (
          <p role="alert" className="mt-2 font-note text-base text-margin">
            {error}
          </p>
        )}
      </MarkerDialog>
    </>
  );
}
```

- [ ] **Step 2: 허브 페이지 작성**

`app/web/src/app/(app)/my/page.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Note, ScreenTitle } from "@/components/paper";
import { LogoutRow } from "@/features/auth/components/logout-row";
import { getCollection } from "@/features/titles/server/collection";
import { requirePageUser } from "@/lib/auth/current-user";

function MenuRow({ href, label, right }: { href: string; label: string; right?: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b-[1.5px] border-dashed border-pencil-soft py-3.5 font-ui text-xl font-bold"
    >
      {label}
      <span className="tabular font-note text-lg text-pencil-soft">{right ?? "→"}</span>
    </Link>
  );
}

export default async function MyPage() {
  const user = await requirePageUser();
  const collection = await getCollection(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>마이페이지</ScreenTitle>
      <Note>@{user.username} · {user.name}</Note>

      <div className="mt-5">
        <MenuRow href="/my/profile" label="내 정보" />
        <MenuRow
          href="/my/collection"
          label="퇴근 도감"
          right={`${collection.earned} / ${collection.total}`}
        />
        <MenuRow href="/my/terms" label="이용약관" />
        <MenuRow href="/my/privacy" label="개인정보 처리방침" />
        <LogoutRow />
      </div>

      <div className="mt-auto pt-10 text-center">
        <Link href="/my/delete" className="font-note text-base text-pencil-soft underline underline-offset-4">
          계정 탈퇴
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 도감 페이지 이동**

`app/web/src/app/(app)/my/collection/page.tsx` 를 만든다 — 기존 내용에서 `LogoutButton` 만 뺀다:

```tsx
import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { getCollection } from "@/features/titles/server/collection";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function CollectionPage() {
  const user = await requirePageUser();
  const collection = await getCollection(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <ScreenTitle>퇴근 도감</ScreenTitle>
        <span className="tabular text-2xl font-bold">
          {collection.earned}
          <small className="text-[15px] font-normal text-pencil-soft"> / {collection.total}</small>
        </span>
      </div>
      <Note>못 얻은 칭호는 힌트만 보여요</Note>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {collection.items.map(({ def, earned, isNew }) => (
          <TitleBadge
            key={def.id}
            name={def.name}
            pose={def.pose}
            locked={!earned}
            hint={earned ? undefined : def.hint}
            isNew={isNew}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 옛 파일 삭제**

```bash
git rm "app/web/src/app/(app)/collection/page.tsx" app/web/src/features/auth/components/logout-button.tsx
```

`/collection` 의 리다이렉트는 Task 12 에서 한꺼번에 넣는다. 그 전까지 `/collection` 은 404 이며, 이는 의도된 중간 상태다.

- [ ] **Step 5: 검증**

```bash
pnpm typecheck && pnpm lint
```

기대: 통과. `LogoutButton` 을 참조하는 곳이 남아 있으면 타입 에러가 잡아낸다 — 남아 있다면 `LogoutRow` 로 바꾼다.

- [ ] **Step 6: 화면 확인**

`pnpm dev` 후 `/my` 에서 도감 카운트가 보이고, 각 줄이 이동하며(약관·프로필은 아직 404), 로그아웃 다이얼로그가 동작한다.

- [ ] **Step 7: 커밋**

```bash
git add -A "app/web/src/app/(app)/my" app/web/src/features/auth/components
git commit -m "Add a my-page hub and move the collection under it"
```

---

### Task 9: 내 정보 화면

**Files:**
- Create: `app/web/src/features/auth/server/profile.ts`
- Create: `app/web/src/features/auth/actions.ts`
- Create: `app/web/src/app/(app)/my/profile/page.tsx`
- Create: `app/web/src/features/auth/components/profile-form.tsx`
- Create: `app/web/src/features/auth/components/notify-switches.tsx`
- Create: `app/web/src/features/auth/components/password-form.tsx`

**Interfaces:**
- Consumes: 기존 `TextField`, `MarkerButton`, `authClient`
- Produces:
  - `getProfile(userId: string): Promise<{ username: string; name: string; notifySignal: boolean; notifySettlement: boolean }>`
  - `updateNameAction(formData: FormData): Promise<{ error?: string; ok?: true }>`
  - `updateNotifyAction(formData: FormData): Promise<void>`

- [ ] **Step 1: `profile.ts` 작성**

```ts
import "server-only";
import { prisma } from "@/lib/db";

export type Profile = {
  username: string;
  name: string;
  notifySignal: boolean;
  notifySettlement: boolean;
};

export async function getProfile(userId: string): Promise<Profile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, name: true, notifySignal: true, notifySettlement: true },
  });
  return { ...user, username: user.username ?? "" };
}
```

- [ ] **Step 2: 서버 액션 작성**

`app/web/src/features/auth/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export const NAME_MIN = 1;
export const NAME_MAX = 12;

export type ActionState = { error?: string; ok?: boolean };

/** 닉네임 변경. 아이디는 친구 검색 키라 바꿀 수 없다 */
export async function updateNameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { error: `닉네임은 ${NAME_MIN}~${NAME_MAX}자로 적어 주세요` };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/my");
  revalidatePath("/my/profile");
  return { ok: true };
}

/** 알림 스위치. 끄면 서버가 푸시 발송 전에 거른다 */
export async function updateNotifyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifySignal: formData.get("notifySignal") === "on",
      notifySettlement: formData.get("notifySettlement") === "on",
    },
  });
  revalidatePath("/my/profile");
}
```

- [ ] **Step 3: 닉네임 폼 작성**

`app/web/src/features/auth/components/profile-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { NAME_MAX, NAME_MIN, updateNameAction, type ActionState } from "../actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateNameAction, {});

  return (
    <form action={action} className="mt-4">
      <TextField
        label="닉네임"
        hint={`${NAME_MIN}~${NAME_MAX}자`}
        name="name"
        defaultValue={name}
        maxLength={NAME_MAX}
        error={state.error}
      />
      {state.error && (
        <p role="alert" className="mt-1 font-note text-base text-margin">
          {state.error}
        </p>
      )}
      {state.ok && <p className="mt-1 font-note text-base text-pencil-soft">저장했어요</p>}
      <MarkerButton type="submit" size="sm" className="mt-2" disabled={pending}>
        {pending ? "저장 중…" : "닉네임 저장"}
      </MarkerButton>
    </form>
  );
}
```

`TextField` 가 `error` prop 을 받는지 `src/components/text-field.tsx` 에서 확인한다 — 받는다면 위처럼 쓰고, 표시까지 내부에서 한다면 아래 `<p role="alert">` 는 중복이니 지운다.

- [ ] **Step 4: 비밀번호 폼 작성**

`app/web/src/features/auth/components/password-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { authClient } from "@/lib/auth/client";

const MIN_LENGTH = 8;

/**
 * 비밀번호 변경. better-auth 가 현재 비밀번호를 요구한다.
 * 다른 기기 세션은 유지한다 — 혼자 쓰는 앱이라 강제 로그아웃은 과하다.
 */
export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("currentPassword") ?? "");
    const next = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");

    setError(null);
    setDone(false);

    if (next.length < MIN_LENGTH) {
      setError(`새 비밀번호는 ${MIN_LENGTH}자 이상이어야 해요`);
      return;
    }
    if (next !== confirm) {
      setError("새 비밀번호가 서로 달라요");
      return;
    }

    setPending(true);
    try {
      const { error: authError } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: false,
      });
      if (authError) {
        setError("지금 비밀번호가 맞지 않아요");
        return;
      }
      form.reset();
      setDone(true);
    } catch {
      setError("인터넷 연결을 확인해 주세요");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <TextField label="지금 비밀번호" name="currentPassword" type="password" autoComplete="current-password" required />
      <TextField label="새 비밀번호" hint={`${MIN_LENGTH}자 이상`} name="newPassword" type="password" autoComplete="new-password" required />
      <TextField label="새 비밀번호 확인" name="confirmPassword" type="password" autoComplete="new-password" required />
      {error && (
        <p role="alert" className="font-note text-base text-margin">
          {error}
        </p>
      )}
      {done && <p className="font-note text-base text-pencil-soft">비밀번호를 바꿨어요</p>}
      <MarkerButton type="submit" size="sm" disabled={pending}>
        {pending ? "바꾸는 중…" : "비밀번호 변경"}
      </MarkerButton>
    </form>
  );
}
```

`authClient.changePassword` 의 반환 형태는 better-auth 버전에 따라 `{ data, error }` 다. 타입 에러가 나면 `src/app/(auth)/login/login-form.tsx` 가 `authClient` 응답을 어떻게 다루는지 보고 같은 방식으로 맞춘다.

- [ ] **Step 5: 알림 스위치 작성**

`app/web/src/features/auth/components/notify-switches.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { updateNotifyAction } from "../actions";

type Props = { notifySignal: boolean; notifySettlement: boolean };

/**
 * 알림 수신 설정. 체크를 바꾸면 곧바로 저장한다 — 저장 버튼을 따로 두면 안 누르고 나간다.
 * 인앱 토스트와 진입 다이얼로그는 이 설정과 무관하다 (앱을 직접 열었을 때의 화면이다).
 */
export function NotifySwitches({ notifySignal, notifySettlement }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={updateNotifyAction}
      className="mt-4 flex flex-col gap-2"
      onChange={() => formRef.current?.requestSubmit()}
    >
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        퇴근 신호 알림
        <input type="checkbox" name="notifySignal" defaultChecked={notifySignal} className="size-5 accent-marker" />
      </label>
      <label className="flex items-center justify-between font-ui text-xl font-bold">
        정산 결과 알림
        <input type="checkbox" name="notifySettlement" defaultChecked={notifySettlement} className="size-5 accent-marker" />
      </label>
      <p className="font-note text-base text-pencil-soft">
        앱을 켜 두었을 때 보이는 화면은 이 설정과 상관없이 나와요
      </p>
    </form>
  );
}
```

- [ ] **Step 6: 페이지 조립**

`app/web/src/app/(app)/my/profile/page.tsx`:

```tsx
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { NotifySwitches } from "@/features/auth/components/notify-switches";
import { PasswordForm } from "@/features/auth/components/password-form";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { getProfile } from "@/features/auth/server/profile";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function ProfilePage() {
  const user = await requirePageUser();
  const profile = await getProfile(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>내 정보</ScreenTitle>
      <Note>아이디는 친구가 나를 찾는 열쇠라 바꿀 수 없어요</Note>

      <p className="mt-4 font-ui text-xl font-bold">
        아이디 <span className="font-note font-normal text-pencil">@{profile.username}</span>
      </p>

      <ProfileForm name={profile.name} />

      <h2 className="mt-8 font-ui text-xl font-bold">비밀번호</h2>
      <PasswordForm />

      <h2 className="mt-8 font-ui text-xl font-bold">알림</h2>
      <NotifySwitches
        notifySignal={profile.notifySignal}
        notifySettlement={profile.notifySettlement}
      />

      <Link href="/my" className="mt-auto pt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        마이페이지로
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: 검증과 화면 확인**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm dev
```

`/my/profile` 에서 닉네임을 바꾸면 `/my` 상단이 따라 바뀌고, 틀린 현재 비밀번호는 오류 문구를 띄우며, 스위치를 끄면 새로고침 후에도 꺼진 채로 있다.

- [ ] **Step 8: 커밋**

```bash
git add app/web/src/features/auth "app/web/src/app/(app)/my/profile"
git commit -m "Let users edit their nickname, password and notification settings"
```

---

### Task 10: 약관 화면

**Files:**
- Create: `app/web/src/app/(app)/my/terms/page.tsx`
- Create: `app/web/src/app/(app)/my/privacy/page.tsx`
- Modify: `app/web/src/app/privacy/page.tsx` (본문만 공용 컴포넌트로 추출. 경로는 그대로 살려 둔다 — 로그인 없이 열려야 하는 앱스토어 제출 URL 이라 `/my/privacy` 로 리다이렉트하면 `/login` 으로 튕긴다)
- Create: `app/web/src/features/legal/privacy-body.tsx`
- Create: `app/web/src/features/legal/terms-body.tsx`

**Interfaces:**
- Consumes: 기존 `Paper`, `ScreenTitle`, `Note`
- Produces: `PrivacyBody`, `TermsBody` — 헤더 없는 본문 컴포넌트. 앱 안(`/my/*`)과 앱 밖(`/privacy`) 양쪽에서 쓴다.

- [ ] **Step 1: 기존 개인정보 처리방침 본문을 컴포넌트로 추출**

`app/web/src/app/privacy/page.tsx` 를 읽고, `<ScreenTitle>` 아래의 `<Section>` 들과 `Section` 헬퍼·`EFFECTIVE_DATE` 를 `app/web/src/features/legal/privacy-body.tsx` 로 옮긴다:

```tsx
import type { ReactNode } from "react";
import { Note } from "@/components/paper";

/** 시행일. 내용을 고치면 이 날짜도 함께 올린다. */
export const PRIVACY_EFFECTIVE_DATE = "2026년 9월 19일";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-ui text-[19px] font-bold leading-snug">{title}</h2>
      <div className="mt-2 space-y-2 font-note text-lg leading-relaxed text-pencil-soft">
        {children}
      </div>
    </section>
  );
}

/** 개인정보 처리방침 본문. 제목은 호출하는 페이지가 그린다 */
export function PrivacyBody() {
  return (
    <>
      <Note className="mt-2">시행일 {PRIVACY_EFFECTIVE_DATE}</Note>
      {/* ↓ 아래에 기존 페이지의 <Section> 블록들이 순서 그대로 들어간다 */}
    </>
  );
}
```

구체적인 이동 절차:

1. `app/web/src/app/privacy/page.tsx` 를 연다.
2. `export default function PrivacyPage()` 의 `return` 안에서 `<ScreenTitle>개인정보 처리방침</ScreenTitle>` **다음 줄부터** 닫는 `</div>` **앞까지** 를 잘라낸다. 여기에는 `<Note className="mt-2">시행일 …</Note>` 와 그 뒤의 `<Section>` 들이 들어 있다.
3. 잘라낸 것 중 `<Note>` 줄은 위 코드에 이미 있으므로 버리고, `<Section>` 블록들만 위 주석 자리에 붙여 넣는다.
4. 원본 파일에 남은 `Section` 헬퍼 함수와 `EFFECTIVE_DATE` 상수, 그리고 이제 쓰이지 않는 `ReactNode`·`Note` import 를 지운다.

문구는 한 글자도 새로 쓰거나 고치지 않는다 — 이미 시행 중인 방침이다. 시행일도 그대로 둔다.

- [ ] **Step 2: 이용약관 본문 작성**

`app/web/src/features/legal/terms-body.tsx`:

```tsx
import type { ReactNode } from "react";
import { Note } from "@/components/paper";

/** 시행일. 내용을 고치면 이 날짜도 함께 올린다. */
export const TERMS_EFFECTIVE_DATE = "2026년 9월 20일";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-ui text-[19px] font-bold leading-snug">{title}</h2>
      <div className="mt-2 space-y-2 font-note text-lg leading-relaxed text-pencil-soft">
        {children}
      </div>
    </section>
  );
}

/** 이용약관 본문. 제목은 호출하는 페이지가 그린다 */
export function TermsBody() {
  return (
    <>
      <Note className="mt-2">시행일 {TERMS_EFFECTIVE_DATE}</Note>

      <Section title="1. 이 약관은">
        <p>
          Tap to Home(이하 &ldquo;서비스&rdquo;)을 쓰는 데 필요한 약속을 담고 있어요. 서비스에
          가입하면 이 약관에 동의한 것으로 봅니다.
        </p>
      </Section>

      <Section title="2. 서비스가 하는 일">
        <p>
          서비스는 하루 동안 &ldquo;퇴근하고 싶다&rdquo; 버튼을 누른 횟수를 기록하고, 친구와
          그 횟수를 견주어 보여주며, 하루가 끝나면 칭호를 드려요. 재미로 만든 서비스이고
          기록이 실제 근무 시간이나 성과를 뜻하지는 않아요.
        </p>
      </Section>

      <Section title="3. 계정">
        <p>
          아이디와 비밀번호로 가입해요. 비밀번호를 다른 사람에게 알려 주지 마세요. 계정으로
          일어난 일은 그 계정의 주인에게 책임이 있어요.
        </p>
        <p>
          닉네임과 아이디에 다른 사람을 괴롭히거나 오해하게 만드는 표현은 쓸 수 없어요.
        </p>
      </Section>

      <Section title="4. 하면 안 되는 일">
        <p>
          자동화 도구로 버튼을 대신 누르거나, 서비스를 망가뜨리려 하거나, 다른 사람의 계정에
          몰래 들어가려 하면 안 돼요. 이런 경우 계정 이용을 제한할 수 있어요.
        </p>
      </Section>

      <Section title="5. 서비스 변경과 중단">
        <p>
          개인이 만들어 운영하는 서비스라 기능이 바뀌거나 서비스가 멈출 수 있어요. 미리 알려
          드리도록 노력하지만, 예기치 못한 사정으로 그러지 못할 수도 있어요.
        </p>
      </Section>

      <Section title="6. 책임의 한계">
        <p>
          서비스는 있는 그대로 제공돼요. 기록이 사라지거나 알림이 늦게 도착해서 생긴 손해에
          대해 서비스는 법이 정한 범위 밖에서는 책임지지 않아요.
        </p>
      </Section>

      <Section title="7. 탈퇴">
        <p>
          마이페이지에서 언제든 탈퇴할 수 있어요. 탈퇴하면 로그인할 수 없고, 친구 목록과
          랭킹에서 사라져요. 같은 아이디로는 다시 가입할 수 없어요.
        </p>
      </Section>

      <Section title="8. 문의">
        <p>서비스에 대한 문의는 개인정보 처리방침에 적힌 연락처로 보내 주세요.</p>
      </Section>
    </>
  );
}
```

- [ ] **Step 3: 앱 안의 두 페이지 작성**

`app/web/src/app/(app)/my/terms/page.tsx`:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ScreenTitle } from "@/components/paper";
import { TermsBody } from "@/features/legal/terms-body";

export const metadata: Metadata = { title: "이용약관 · Tap to Home" };

export default function MyTermsPage() {
  return (
    <div className="flex flex-1 flex-col pb-4">
      <ScreenTitle>이용약관</ScreenTitle>
      <TermsBody />
      <Link href="/my" className="mt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        마이페이지로
      </Link>
    </div>
  );
}
```

`app/web/src/app/(app)/my/privacy/page.tsx` 는 같은 모양으로 `PrivacyBody` 와 제목 "개인정보 처리방침" 을 쓴다.

- [ ] **Step 4: 앱 밖 `/privacy` 를 본문 공유로 전환**

`app/web/src/app/privacy/page.tsx` 는 앱스토어 제출 URL 이라 **리다이렉트하지 않고 그대로 살려 둔다** (로그인 없이 열려야 한다). 본문만 컴포넌트로 바꾼다:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Paper, ScreenTitle } from "@/components/paper";
import { PrivacyBody } from "@/features/legal/privacy-body";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · Tap to Home",
  description: "Tap to Home 이 수집하는 개인정보와 처리 방식",
};

export default function PrivacyPage() {
  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-16">
        <ScreenTitle>개인정보 처리방침</ScreenTitle>
        <PrivacyBody />
        <Link href="/" className="mt-8 block text-center font-note text-lg text-pencil-soft underline underline-offset-4">
          앱으로 돌아가기
        </Link>
      </div>
    </Paper>
  );
}
```

기존 파일 하단에 다른 링크나 요소가 있으면 유지한다.

- [ ] **Step 5: 검증과 확인**

```bash
pnpm typecheck && pnpm lint
pnpm dev
```

`/my/terms`, `/my/privacy`, `/privacy` 세 화면이 모두 열리고 본문이 같은지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add app/web/src/features/legal "app/web/src/app/(app)/my/terms" "app/web/src/app/(app)/my/privacy" app/web/src/app/privacy/page.tsx
git commit -m "Add terms of service and share the legal copy across routes"
```

---

### Task 11: 계정 탈퇴

**Files:**
- Create: `app/web/src/features/auth/server/delete-account.ts`
- Modify: `app/web/src/features/auth/actions.ts`
- Create: `app/web/src/app/(app)/my/delete/page.tsx`
- Create: `app/web/src/features/auth/components/delete-account-form.tsx`
- Create: `app/web/src/features/auth/server/delete-account.test.ts`

**Interfaces:**
- Consumes: Task 2 의 `ACTIVE_USER` 와 `getCurrentUser` 의 탈퇴 차단, Task 1 의 `User.deletedAt`
- Produces:
  - `softDeleteAccount(userId: string, now?: Date): Promise<void>` — `deletedAt` 을 채우고 세션·푸시 토큰을 지운다
  - `deleteAccountAction(prev: ActionState, formData: FormData): Promise<ActionState>`

- [ ] **Step 1: `delete-account.ts` 작성**

```ts
import "server-only";
import { prisma } from "@/lib/db";

/**
 * 계정 탈퇴 (소프트 삭제). row 와 친구 관계는 남기고 `deletedAt` 만 채운다 —
 * 조회 지점(src/lib/db/active-user.ts)이 전부 이 값을 보고 거른다.
 *
 * 세션과 푸시 토큰은 실제로 지운다. 남겨 두면 탈퇴한 계정으로 알림이 계속 가고,
 * 세션은 다음 요청에서 어차피 거부되므로 보관할 이유가 없다.
 */
export async function softDeleteAccount(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { deletedAt: now } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.pushToken.deleteMany({ where: { userId } }),
  ]);
}
```

- [ ] **Step 2: 서버 액션 추가**

`app/web/src/features/auth/actions.ts` 의 맨 아래에 추가한다 (상단 import 에 `softDeleteAccount` 를 더한다):

```ts
/**
 * 계정 탈퇴. 오조작을 막기 위해 자기 아이디를 정확히 입력해야 한다.
 * 성공하면 세션이 사라지므로 이후 요청은 /login 으로 튕긴다.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  const typed = String(formData.get("confirmUsername") ?? "").trim().toLowerCase();
  if (typed !== user.username.toLowerCase()) {
    return { error: "아이디가 맞지 않아요" };
  }

  await softDeleteAccount(user.id);
  redirect("/login");
}
```

`redirect` 는 예외를 던져 함수를 끝내므로 반환 타입 불일치가 나지 않는다.

- [ ] **Step 3: 폼 컴포넌트 작성**

`app/web/src/features/auth/components/delete-account-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { deleteAccountAction, type ActionState } from "../actions";

export function DeleteAccountForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccountAction, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  return (
    <form action={action} className="mt-6">
      <TextField
        label="확인"
        hint={`@${username} 를 그대로 입력`}
        name="confirmUsername"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {state.error && (
        <p role="alert" className="mt-1 font-note text-base text-margin">
          {state.error}
        </p>
      )}
      <MarkerButton type="submit" className="mt-4 w-full" disabled={!matches || pending}>
        {pending ? "탈퇴하는 중…" : "계정 탈퇴"}
      </MarkerButton>
    </form>
  );
}
```

- [ ] **Step 4: 페이지 작성**

`app/web/src/app/(app)/my/delete/page.tsx`:

```tsx
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { DeleteAccountForm } from "@/features/auth/components/delete-account-form";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function DeleteAccountPage() {
  const user = await requirePageUser();

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>계정 탈퇴</ScreenTitle>
      <Note>되돌릴 수 없어요</Note>

      <ul className="mt-5 space-y-2 font-note text-lg leading-relaxed text-pencil">
        <li>· 친구 목록과 랭킹에서 사라져요</li>
        <li>· 지금까지의 퇴근 기록과 도감을 볼 수 없어요</li>
        <li>· 알림이 더 이상 오지 않아요</li>
        <li>· @{user.username} 로는 다시 가입할 수 없어요</li>
      </ul>

      <DeleteAccountForm username={user.username} />

      <Link href="/my" className="mt-auto pt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        그만두기
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: 테스트 작성**

`app/web/src/features/auth/server/delete-account.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { softDeleteAccount } from "./delete-account";

let me: { id: string; username: string };

beforeAll(async () => {
  me = await createTestUser("del");
  await prisma.pushToken.create({
    data: { userId: me.id, token: `tok_${me.id}`, platform: "ios" },
  });
});
afterAll(async () => {
  await deleteTestUsers([me.id]);
});

describe("softDeleteAccount", () => {
  it("marks the user deleted and clears sessions and push tokens", async () => {
    await softDeleteAccount(me.id);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { deletedAt: true, username: true },
    });
    expect(user.deletedAt).not.toBeNull();
    // 아이디는 남아 있어 재사용할 수 없다
    expect(user.username).toBe(me.username);

    expect(await prisma.session.count({ where: { userId: me.id } })).toBe(0);
    expect(await prisma.pushToken.count({ where: { userId: me.id } })).toBe(0);
  });
});
```

- [ ] **Step 6: 테스트 실행**

```bash
pnpm test -- delete-account
```

기대: PASS.

- [ ] **Step 7: 화면 확인**

`pnpm dev` 후 `/my/delete` 에서 아이디를 틀리게 입력하면 버튼이 비활성, 정확히 입력하면 활성화된다. 실제 탈퇴는 테스트 계정으로만 시도한다 — 탈퇴 후 `/login` 으로 튕기고 같은 아이디로 재가입이 거절되는지 확인한다.

- [ ] **Step 8: 검증과 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test
git add app/web/src/features/auth "app/web/src/app/(app)/my/delete"
git commit -m "Let users delete their account"
```

---

### Task 12: 탭 전환과 옛 경로 정리

새 화면이 모두 준비된 뒤 마지막으로 탭을 바꾸고 `/today` 를 없앤다.

**Files:**
- Modify: `app/web/src/components/bottom-nav.tsx`
- Modify: `app/web/src/features/race/components/race-screen.tsx`
- Create: `app/web/src/app/(app)/today/page.tsx` (기존 내용을 리다이렉트로 **교체**)
- Create: `app/web/src/app/(app)/collection/page.tsx` (리다이렉트)
- Modify: `app/web/src/app/dev/ui/screens.tsx` (깨진 참조가 있으면)

**Interfaces:**
- Consumes: Task 6 의 `/records`, Task 8 의 `/my`, `/my/collection`
- Produces: 탭 4개

- [ ] **Step 1: 하단 탭 4개로**

`bottom-nav.tsx` 의 `ITEMS` 와 그리드를 바꾼다:

```tsx
const ITEMS = [
  { href: "/", label: "레이스" },
  { href: "/ranking", label: "랭킹" },
  { href: "/friends", label: "친구" },
  { href: "/my", label: "마이" },
] as const;
```

`<ul>` 의 `grid-cols-5` 를 `grid-cols-4` 로 바꾼다.

활성 판정은 `pathname === item.href` 인데 `/my/profile` 같은 하위 경로에서도 "마이" 가 활성이어야 한다. `const active = ...` 줄을 다음으로 바꾼다:

```tsx
          // 마이페이지는 하위 화면(/my/profile 등)에서도 탭이 눌린 상태로 보여야 한다
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
```

- [ ] **Step 2: 레이스 화면에 기록보기 버튼 추가**

`race-screen.tsx` 의 `TapButton` 아래 `<p className="mt-2 ...">` 블록을 다음으로 바꾼다:

```tsx
        <p className="mt-2 font-note text-[19px] text-pencil-soft">
          {data.settled ? "오늘은 정산했어요" : "꾹꾹 누르면 한 칸씩 간다"}
        </p>
        <Link
          href="/records"
          className="mt-3 font-note text-lg text-pencil underline underline-offset-4"
        >
          기록 보기
        </Link>
```

`Link` 는 이미 import 돼 있다.

- [ ] **Step 3: `/today` 를 리다이렉트로 교체**

`app/web/src/app/(app)/today/page.tsx` 의 내용 전체를 바꾼다:

```tsx
import { redirect } from "next/navigation";

/**
 * 정산이 자정 자동으로 바뀌면서 이 화면은 /records 로 합쳐졌다 (ADR 0008).
 * 옛 푸시 알림과 북마크가 여기로 들어올 수 있어 리다이렉트만 남긴다.
 */
export default function TodayPage() {
  redirect("/records");
}
```

- [ ] **Step 4: `/collection` 리다이렉트 추가**

`app/web/src/app/(app)/collection/page.tsx` 를 새로 만든다:

```tsx
import { redirect } from "next/navigation";

/** 도감은 마이페이지 아래로 옮겼다 */
export default function CollectionPage() {
  redirect("/my/collection");
}
```

- [ ] **Step 5: 남은 참조 정리**

```bash
grep -rn '"/today"\|"/collection"\|href="/today"\|href="/collection"' app/web/src --include=*.tsx --include=*.ts
```

리다이렉트 파일 자신을 제외하고 남은 참조가 있으면 `/records`·`/my/collection` 로 바꾼다. `src/app/dev/ui/screens.tsx` 가 이 화면들을 미리보기로 끌어 쓰고 있다면 새 경로의 컴포넌트를 가리키게 고친다.

- [ ] **Step 6: 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm dev
```

확인 항목:
- 하단 탭이 4개다
- `/my/profile` 에서 "마이" 탭이 눌린 상태다
- 레이스 화면의 "기록 보기" 가 `/records` 로 간다
- `/today` → `/records`, `/collection` → `/my/collection` 으로 튕긴다

- [ ] **Step 7: 커밋**

```bash
git add app/web/src/components/bottom-nav.tsx app/web/src/features/race/components/race-screen.tsx "app/web/src/app/(app)/today" "app/web/src/app/(app)/collection" app/web/src/app/dev/ui/screens.tsx
git commit -m "Switch to four tabs and redirect the retired routes"
```

---

### Task 13: 문서 갱신과 ADR

**Files:**
- Modify: `docs/features.md`
- Create: `docs/decisions/0008-nightly-settlement-cron.md`
- Modify: `docs/deploy.md` (`CRON_SECRET` 환경변수)

**Interfaces:**
- Consumes: Task 1~12 에서 확정된 동작
- Produces: 없음

- [ ] **Step 1: ADR 작성**

`docs/decisions/0008-nightly-settlement-cron.md`:

```markdown
# 0008. 자정 크론 자동 정산

2026-09-20 · 결정됨

## 맥락

정산은 사용자가 `/today` 의 "오늘 정산" 버튼을 눌러야 실행됐다. 그런데 이 앱의 하루는
KST 자정에 끝난다 — 버튼을 누르지 않고 잠들면 그날의 칭호가 영영 없고, 다음 날 첫 탭이
어제 run 을 건드리지도 않는다. "하루 끝에 칭호를 받는다" 는 보상 루프가 사용자의 기억력에
매달려 있었다.

## 선택지

1. **Vercel Cron** — `vercel.json` 의 crons 로 `/api/cron/settle` 을 매일 부른다.
2. **Supabase pg_cron + Edge Function** — DB 옆에서 돈다.
3. **지연 정산(lazy)** — 크론 없이, 날짜가 바뀐 뒤 접속하면 전날 run 을 정산한다.

## 결정

**1번, Vercel Cron.**

3번(lazy)은 인프라가 0 이지만 자정 알림을 보낼 수 없다. 정산 결과를 알림으로 전하는 것이
이 변경의 절반이라 탈락이다. 2번은 정산 규칙(`evaluateTitles`)이 TypeScript 에 있어
Edge Function 에 중복 구현하거나 결국 HTTP 로 Next.js 를 부르게 된다 — 1번에 레이어만
하나 더 얹는 셈이다.

## 구현

- 스케줄은 UTC `5 15 * * *` = KST 00:05. 정각을 피한 이유는 23:59:5x 의 탭이 커밋될 여유를
  두고, 스케줄러가 분 단위로 밀려도 날짜 경계를 넘지 않게 하기 위해서다.
- 인증은 `Authorization: Bearer $CRON_SECRET`. 공개 URL 이라 없으면 401 이다.
- 대상은 어제 `runDate` 의 `daily_run` 중 `tapCount > 0` 이고 결과가 없는 행. 탭 0회 유저는
  정산도 알림도 하지 않는다 — 누르지 않은 날에 "오늘의 결과" 알림이 오면 성가시다.
- 커넥션 풀이 5개뿐이라(`src/lib/db`) 한 번에 5건씩만 돌린다. 정산 한 건이 트랜잭션과
  그 안의 랭킹 조회를 쓰므로 전부 동시에 던지면 풀이 마르고 서로를 기다린다.
- 재실행은 안전하다. `settleRun` 이 `daily_run` 을 `FOR UPDATE` 로 잠그고 이미 결과가
  있으면 그대로 돌려준다 (기존 성질을 그대로 쓴다).

## 결과

- `/today` 화면과 `settleTodayAction` 이 사라지고 `/records` 로 합쳐졌다.
- 푸시를 못 받는 경로(브라우저 접속, 알림 거부)를 위해 앱 진입 시 안 본 결과를 다이얼로그로
  한 번 띄운다. 그 기준이 `daily_result.seenAt` 이다.
- 배치 실패는 다음 날 크론이 다시 잡지 않는다. 응답의 `failed` 에 `dailyRunId` 를 남겨
  사람이 보고 판단하게 한다. 실패가 잦아지면 그때 재시도 큐를 만든다.
```

- [ ] **Step 2: `docs/features.md` 의 F0-5 수정**

`**F0-5 로그아웃**` 의 첫 두 불릿을 다음으로 바꾼다:

```markdown
- `/my`(마이페이지) 메뉴 목록의 맨 아래에 로그아웃 줄을 둔다. 상단에 닉네임과 `@아이디` 가 이미 보이므로 "누구로 로그인 중" 을 따로 적지 않는다.
- 누르면 확인 다이얼로그를 거친 뒤 세션을 지우고 `/login` 으로 보낸다. 되돌릴 수 없는 동작은 아니지만 연타 중 잘못 누르면 레이스가 끊긴다.
```

- [ ] **Step 3: `docs/features.md` 의 F3 정산 항목 수정**

`**F3-1 행동 패턴 분석 칭호**` 의 마지막 불릿을 바꾼다:

```markdown
- 판정 시각: 하루 종료(KST 자정) 배치. 사용자가 직접 누르는 "오늘 정산" 은 없앴다 (ADR 0008).
```

그리고 문서 맨 아래 `## 정산 화면` 섹션 전체를 다음으로 교체한다:

```markdown
## F3-3 자동 정산과 기록 보기

- 매일 KST 00:05 에 크론이 어제의 정산을 돌린다. 대상은 어제 탭이 **1회 이상** 있는 유저뿐이다 — 누르지 않은 날은 정산도 알림도 없다 (ADR 0008).
- 정산되면 알림이 간다. 문구는 대표 칭호 기준(`오늘 당신은 '마음만 이미 집에 있음'`), 칭호가 없으면 횟수(`어제 1,204번 퇴근하고 싶었어요`). 탭하면 그날의 기록 상세를 연다.
- 알림을 못 받는 경로(브라우저 접속, 알림 거부)를 위해, 아직 보지 않은 정산 결과가 있으면 앱 진입 시 다이얼로그로 한 번 띄운다. 여러 건이 쌓였으면 가장 최근 한 건만 보여주고 나머지는 함께 본 것으로 처리한다.
- 기록은 레이스 화면의 "기록 보기" 로 들어가는 `/records` 에서 본다. 탭이 아니다. 맨 위에 오늘 진행 상황, 아래에 정산된 날들이 최신순으로 쌓인다 (최근 30일).
- `/records/<날짜>` 는 그날의 총 횟수·첫 탭 시각·랭킹·획득 칭호를 보여준다. 예: `오늘 당신은 마음만 먼저 퇴근한 자 / 총 103회 / 첫 퇴근 욕구 09:32 / 오늘 랭킹 2위`.
- 수용 기준: 탭 0회인 유저에게는 알림이 오지 않는다. 자정을 넘긴 뒤 앱을 열면 어제 결과가 한 번 뜨고, 닫으면 다시 뜨지 않는다.

## F4 마이페이지

- 하단 탭은 레이스·랭킹·친구·마이 4개다. 도감은 `/my/collection` 으로, 정산 결과는 `/records` 로 옮겼다.
- `/my` 허브는 닉네임과 `@아이디` 아래에 내 정보·도감·이용약관·개인정보 처리방침·로그아웃 줄을 둔다. 도감 줄에는 획득 수(`14/50`)를 함께 보여준다. 계정 탈퇴는 맨 아래에 한 단 낮춰 둔다.
- `/my/profile` 에서 닉네임(1~12자)과 비밀번호를 바꾸고, 알림 두 가지(퇴근 신호·정산 결과)를 켜고 끈다. 아이디는 친구 검색 키라 바꿀 수 없다.
- 알림 설정은 **푸시에만** 적용한다. 인앱 토스트와 진입 다이얼로그는 앱을 직접 열었을 때의 화면이라 설정과 무관하다.
- `/my/delete` 는 사라지는 것을 먼저 알리고, 자기 아이디를 정확히 입력해야 버튼이 열린다. 탈퇴는 소프트 삭제다 — 로그인이 막히고 친구 목록·랭킹·검색에서 사라지며, 같은 아이디로 재가입할 수 없다.
- 수용 기준: 탈퇴한 계정은 친구 검색에 나오지 않고 상대의 랭킹에서도 사라진다. 로그아웃 후 뒤로 가기로 앱 화면에 돌아올 수 없다.
```

- [ ] **Step 4: `docs/deploy.md` 에 환경변수 추가**

환경변수 목록에 한 줄 추가한다 (기존 표·목록의 형식을 따른다):

```markdown
- `CRON_SECRET` — 자정 정산 크론(`/api/cron/settle`) 인증. Vercel 프로젝트 설정에 넣으면 Cron 요청에 자동으로 실린다. 값이 없으면 엔드포인트가 500 을 돌려주고 정산이 돌지 않는다 (ADR 0008).
```

- [ ] **Step 5: 최종 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

기대: 전부 통과.

- [ ] **Step 6: 커밋**

```bash
git add docs/features.md docs/decisions/0008-nightly-settlement-cron.md docs/deploy.md
git commit -m "Document the tab rework and nightly settlement"
```

---

## 실행 후 수동 확인

배포 전에 확인할 것:

1. Vercel 프로젝트 환경변수에 `CRON_SECRET` 을 넣는다. 넣지 않으면 크론이 500 을 받고 정산이 돌지 않는다.
2. 배포 후 Vercel 대시보드의 Cron Jobs 탭에 `/api/cron/settle` 이 `5 15 * * *` 로 등록됐는지 본다.
3. 첫날 밤이 지난 뒤 Vercel 로그에서 `targeted`/`settled` 수를 확인하고 `failed` 가 비어 있는지 본다.
4. 실기기(Flutter 셸)에서 정산 푸시를 탭하면 `/records/<날짜>` 가 열리는지 확인한다 — `TapToHome` 채널의 path 처리 경로다.
