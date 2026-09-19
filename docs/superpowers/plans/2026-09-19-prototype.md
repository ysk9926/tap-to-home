# Tap to Home Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아이디 로그인 → 친구 아이디 검색·등록 → 연타 레이스(실시간) → 퇴근 신호 토스트 → 오늘 정산·칭호·도감까지 전 기능이 실제 DB·API 위에서 한 번에 흐르는 프로토타입.

**Architecture:** Next.js 16 App Router 하나에 화면·API 를 모두 둔다. 도메인 로직은 `src/features/<domain>/` 의 순수 함수(단위 테스트)와 `server/` 서비스 함수(로컬 Postgres 통합 테스트)로 나누고, route handler 와 server action 은 인증·검증 후 서비스 함수를 부르는 얇은 층으로 유지한다. 클라이언트는 TanStack Query 로 낙관적 탭 → 300ms 배치 전송 → 폴링(2s) 으로 먼저 동작시키고, 마지막 태스크에서 Supabase Realtime broadcast 로 폴링을 대체한다.

**Tech Stack:** Next.js 16.3 (App Router, `src/`, `proxy.ts`), React 19, TypeScript, Tailwind v4 토큰, TanStack Query v5, better-auth 1.7 (+ `username` 플러그인, Prisma adapter), Prisma 7 + `@prisma/adapter-pg`, Supabase Postgres/Realtime, vitest (신규).

**Spec:** `docs/superpowers/specs/2026-09-19-prototype-design.md`

## Global Constraints

- 웹은 `app/web/AGENTS.md` 를 따른다. Next 16 은 `middleware.ts` 대신 `src/proxy.ts`. 세션은 서버 `auth.api.getSession({ headers })`, 클라이언트 `useSession()`.
- Prisma 7: `schema.prisma` 에 URL 없음(`prisma.config.ts` 가 `DIRECT_URL`). 쿼리는 `import { prisma } from "@/lib/db"`. 타입만 `@/generated/prisma/client` 에서 import. 마이그레이션은 `pnpm db:migrate` 로 만들고 `prisma/migrations/*` 를 커밋한다.
- better-auth 코어 모델(User/Session/Account/Verification)의 필드명은 바꾸지 않는다. `email` 컬럼은 유지하고 가입 시 `${username}@id.tap-to-home.local` 로 채운다.
- UI: 색은 토큰 클래스만(`bg-paper`, `text-pencil`, `border-marker`…), 형광펜(`hl`/`Highlight`)은 한 화면에 한 군데, 졸라맨은 `Stickman` 만, 그라데이션·그림자·두 번째 강조색 금지. 새 프리미티브는 `/dev/ui` 에 올린다.
- 사용자 문구는 한국어, 코드·식별자·커밋 메시지는 영어.
- 하루 기준은 KST 고정. `run_date` = KST 날짜.
- Supabase 는 Realtime 채널에만 쓴다(`src/lib/supabase/*`). DB 는 Prisma 로만.
- 완료 기준: `pnpm typecheck && pnpm lint && pnpm test` 통과. 스키마를 건드린 태스크는 migration 파일 포함.
- 모든 명령은 저장소 루트에서 실행한다. web 전용 명령은 `pnpm --filter web <script>`.

## 파일 구조 (전체)

```
app/web/
  package.json                          test / test:watch 스크립트, vitest devDep
  vitest.config.ts                      alias @ → src, server-only 스텁, setup 파일
  test/setup.ts                         TEST_DATABASE_URL → DATABASE_URL
  test/server-only-stub.ts              빈 모듈
  test/db.ts                            createTestUser / deleteTestUsers
  prisma/schema.prisma                  username 필드 + 도메인 모델 6개
  prisma/migrations/<ts>_domain_init/   생성물
  src/proxy.ts                          세션 쿠키 유무로 /login 리다이렉트
  src/lib/kst.ts (+test)                KST 날짜·시각 유틸
  src/lib/api.ts                        jsonError / parseJson (서버)
  src/lib/fetch-json.ts                 fetchJson + ApiError (클라이언트)
  src/lib/auth/server.ts                username 플러그인 추가
  src/lib/auth/client.ts                usernameClient 추가
  src/lib/auth/placeholder-email.ts (+test)
  src/lib/auth/current-user.ts          getCurrentUser(headers) / requireUser
  src/components/text-field.tsx         밑줄 입력칸
  src/components/bottom-nav.tsx         하단 탭 4개
  src/app/page.tsx                      삭제 (→ (app)/page.tsx)
  src/app/(auth)/layout.tsx             Paper 바탕
  src/app/(auth)/login/page.tsx, login-form.tsx
  src/app/(auth)/signup/page.tsx, signup-form.tsx
  src/app/(app)/layout.tsx              세션 확인 + Paper + BottomNav
  src/app/(app)/page.tsx                RaceScreen
  src/app/(app)/friends/page.tsx        FriendsScreen
  src/app/(app)/today/page.tsx          정산
  src/app/(app)/collection/page.tsx     도감
  src/app/api/race/today/route.ts
  src/app/api/taps/route.ts
  src/app/api/friends/route.ts
  src/app/api/users/search/route.ts
  src/app/api/signals/route.ts
  src/app/api/signals/unread/route.ts
  src/features/race/stages.ts           stageIndexOf 추가
  src/features/race/race-state.ts (+test)      정렬·내 카운트 패치(순수)
  src/features/race/tap-batcher.ts (+test)     300ms 배치
  src/features/race/server/record-taps.ts (+integration test)
  src/features/race/server/today.ts (+integration test)
  src/features/race/hooks/use-race-today.ts
  src/features/race/hooks/use-tap.ts
  src/features/race/components/race-screen.tsx
  src/features/friends/server/list-friend-ids.ts
  src/features/friends/server/friends.ts (+integration test)
  src/features/friends/components/friends-screen.tsx
  src/features/signal/combo.ts (+test)
  src/features/signal/messages.ts (+test)
  src/features/signal/server/signals.ts (+integration test)
  src/features/signal/hooks/use-signal-toasts.ts
  src/features/signal/components/signal-toast-layer.tsx
  src/features/titles/catalog.ts
  src/features/titles/evaluate.ts (+test)
  src/features/titles/server/settle.ts (+integration test)
  src/features/titles/server/today-summary.ts
  src/features/titles/server/collection.ts
  src/features/titles/actions.ts        settleTodayAction (server action)
  src/features/titles/components/today-result-card.tsx
  src/features/realtime/channels.ts     채널·이벤트 이름, payload 타입
  src/features/realtime/server/broadcast.ts
  src/features/realtime/hooks/use-race-realtime.ts
docs/
  data-model.md, features.md, goal.md, design.md, tech-stack.md, deploy.md 갱신
  decisions/0005-username-login-and-title-catalog-in-code.md
```

---

### Task 1: 테스트 도구와 KST 유틸

**Files:**
- Modify: `app/web/package.json`
- Create: `app/web/vitest.config.ts`, `app/web/test/setup.ts`, `app/web/test/server-only-stub.ts`
- Create: `app/web/src/lib/kst.ts`, `app/web/src/lib/kst.test.ts`
- Modify: `package.json` (루트, `test` 스크립트)

**Interfaces:**
- Produces: `todayKst(now?: Date): string` ("YYYY-MM-DD"), `kstDate(now?: Date): Date` (`@db.Date` 컬럼용 UTC 자정), `kstHour(d: Date): number`, `kstMinutes(d: Date): number`, `kstTimeLabel(d: Date): string` ("09:32"), `kstDateLabel(ymd: string): string` ("9월 19일 금요일"), `runDateToYmd(d: Date): string`.

- [ ] **Step 1: vitest 설치와 스크립트**

```bash
pnpm --filter web add -D vitest
```

`app/web/package.json` scripts 에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

루트 `package.json` scripts 에 추가:

```json
"test": "pnpm --filter web test"
```

- [ ] **Step 2: vitest 설정과 스텁**

`app/web/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url));

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // 통합 테스트가 같은 DB 를 쓰므로 파일 간 병렬 실행을 끈다
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": src,
      // `import "server-only"` 는 RSC 밖에서 throw 하므로 테스트에서는 빈 모듈로 대체
      "server-only": serverOnlyStub,
    },
  },
});
```

`app/web/test/server-only-stub.ts`:

```ts
export {};
```

`app/web/test/setup.ts`:

```ts
import "dotenv/config";

// 통합 테스트는 로컬 docker Postgres(pnpm db:up)를 쓴다. .env 의 DATABASE_URL(Supabase)을 덮어쓴다.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://taptohome:taptohome@localhost:5432/taptohome";
```

- [ ] **Step 3: KST 유틸 실패 테스트**

`app/web/src/lib/kst.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  kstDate,
  kstDateLabel,
  kstHour,
  kstMinutes,
  kstTimeLabel,
  runDateToYmd,
  todayKst,
} from "./kst";

describe("kst", () => {
  it("todayKst rolls over at 15:00 UTC", () => {
    expect(todayKst(new Date("2026-09-19T14:59:59Z"))).toBe("2026-09-19");
    expect(todayKst(new Date("2026-09-19T15:00:00Z"))).toBe("2026-09-20");
  });

  it("kstDate is UTC midnight of the KST date", () => {
    expect(kstDate(new Date("2026-09-19T20:00:00Z")).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("runDateToYmd reads a @db.Date value back", () => {
    expect(runDateToYmd(new Date("2026-09-20T00:00:00.000Z"))).toBe("2026-09-20");
  });

  it("kstHour / kstMinutes", () => {
    const d = new Date("2026-09-19T00:32:00Z"); // 09:32 KST
    expect(kstHour(d)).toBe(9);
    expect(kstMinutes(d)).toBe(9 * 60 + 32);
  });

  it("labels", () => {
    expect(kstTimeLabel(new Date("2026-09-19T00:32:00Z"))).toBe("09:32");
    expect(kstDateLabel("2026-09-19")).toBe("9월 19일 토요일");
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `pnpm --filter web test src/lib/kst.test.ts`
Expected: FAIL — `Cannot find module './kst'`

- [ ] **Step 5: 구현**

`app/web/src/lib/kst.ts`:

```ts
/** 하루 기준은 KST(UTC+9) 고정. docs/goal.md 의 "하루의 기준 시각" 결정 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function shifted(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MS);
}

/** 오늘의 KST 날짜 "YYYY-MM-DD" */
export function todayKst(now: Date = new Date()): string {
  return shifted(now).toISOString().slice(0, 10);
}

/** Prisma `@db.Date` 컬럼에 넣는 값. 해당 KST 날짜의 UTC 자정 */
export function kstDate(now: Date = new Date()): Date {
  return new Date(`${todayKst(now)}T00:00:00.000Z`);
}

/** `@db.Date` 로 읽은 값을 "YYYY-MM-DD" 로 */
export function runDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function kstHour(d: Date): number {
  return shifted(d).getUTCHours();
}

/** 자정부터 지난 분. 09:30 → 570 */
export function kstMinutes(d: Date): number {
  const s = shifted(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

/** "09:32" */
export function kstTimeLabel(d: Date): string {
  const s = shifted(d);
  const hh = String(s.getUTCHours()).padStart(2, "0");
  const mm = String(s.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "9월 19일 토요일" */
export function kstDateLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm --filter web test src/lib/kst.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: 커밋**

```bash
git add app/web/package.json pnpm-lock.yaml package.json app/web/vitest.config.ts app/web/test app/web/src/lib/kst.ts app/web/src/lib/kst.test.ts
git commit -m "Add vitest and KST date utilities"
```

---

### Task 2: 문서·스키마·마이그레이션

**Files:**
- Modify: `docs/data-model.md`, `docs/features.md`, `docs/goal.md`, `docs/README.md`
- Create: `docs/decisions/0005-username-login-and-title-catalog-in-code.md`
- Modify: `app/web/prisma/schema.prisma`
- Create (generated): `app/web/prisma/migrations/<timestamp>_domain_init/migration.sql`

**Interfaces:**
- Produces Prisma 모델: `User.username`, `User.displayUsername`, `Friendship`, `DailyRun`, `TapEvent`, `Signal`, `UserTitle`, `DailyResult`, enum `FriendshipStatus`, `SignalLevel`. 복합 unique 이름: `DailyRun.userId_runDate`, `Friendship.requesterId_addresseeId`, `UserTitle.userId_titleId`.

- [ ] **Step 1: `docs/features.md` 에 F0 절 추가 (F1 위)**

```markdown
## F0 계정과 친구 등록

**F0-1 아이디 로그인**

- 이메일 없이 **아이디 + 비밀번호** 로 가입·로그인한다. 아이디는 영문 소문자·숫자·`_`, 3~20자. 대문자로 입력해도 소문자로 저장한다.
- 가입 시 닉네임(1~12자)을 받는다. 레이스·랭킹·신호 문구에는 닉네임을, 검색에는 아이디를 쓴다.
- 수용 기준: 가입 즉시 로그인 상태로 `/` 에 진입한다. 중복 아이디는 "이미 쓰는 아이디예요" 로 거절한다.

**F0-2 친구 등록 (아이디 검색)**

- `/friends` 에서 상대 아이디를 정확히 입력해 검색하고 "친구 등록" 을 누르면 즉시 양방향 친구가 된다 (수락 절차 없음).
- 내 아이디를 화면 상단에 보여줘 상대가 검색할 수 있게 한다.
- 본인·이미 친구·없는 아이디는 각각 안내 문구로 거절한다.
- 수용 기준: A 가 B 를 등록하면 A·B 모두의 레이스 화면에 서로가 보인다.
```

- [ ] **Step 2: `docs/data-model.md` 를 아래 내용으로 교체**

```markdown
# Data Model (PostgreSQL)

auth 테이블(`user`, `session`, `account`, `verification`)은 better-auth 계약이며 `app/web/prisma/schema.prisma` 에 있다. 도메인 모델도 같은 파일의 `// ── <domain>` 구역에 있다. 컬럼 이름은 Prisma 기본(camelCase)을 따르고, 테이블 이름만 `@@map` 으로 snake_case 다. 칭호 마스터는 테이블이 아니라 코드(`src/features/titles/catalog.ts`)에 있다 (`decisions/0005`).

## user (better-auth + username 플러그인)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| username | text unique null | 로그인·검색 키. 소문자 정규화 |
| displayUsername | text null | 플러그인 계약. 입력 원문 |
| email | text unique | `${username}@id.tap-to-home.local` 자동 생성. UI 비노출 |
| name | text | 닉네임(표시명) |

## friendship — 친구 관계

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| requesterId | text fk user | 등록한 쪽 |
| addresseeId | text fk user | |
| status | enum pending/accepted/blocked | 프로토타입은 항상 `accepted` 로 생성 |
| createdAt | timestamptz | |

unique(requesterId, addresseeId). 양방향 조회는 두 컬럼 OR.

## daily_run — 하루 단위 레이스 상태

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| userId | text fk user | |
| runDate | date | KST 기준 |
| tapCount | int | 오늘 누적. 화면과 랭킹은 이 값만 읽는다 |
| stage | smallint | 0~5, tapCount 로부터 계산해 저장 |
| firstTapAt | timestamptz null | 칭호 판정 |
| lastTapAt | timestamptz null | |

unique(userId, runDate). 랭킹: 나+친구 userId IN (...) AND runDate = today ORDER BY tapCount DESC.

## tap_event — 탭 로그 (칭호 분석용)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigserial pk | |
| dailyRunId | uuid fk daily_run | |
| tappedAt | timestamptz | 배치가 서버에 도착한 시각 |
| batchSize | smallint | 클라이언트가 300ms 로 묶어 보낸 탭 수 |

## signal — 퇴근 신호

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| senderId | text fk user | |
| receiverId | text fk user | |
| level | enum normal/strong/urgent/rescue | 1/5/10/30 연타 |
| sentAt | timestamptz | |
| readAt | timestamptz null | 미읽음 조회 후 세팅 |

같은 (senderId, receiverId, level) 은 10분에 한 번만 생성한다.

## user_title — 칭호 획득 기록

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| userId | text fk user | |
| titleId | text | `catalog.ts` 의 id. FK 없음 |
| firstEarnedOn | date | 이 값이 오늘이면 도감에서 NEW |
| earnedCount | int | 반복 획득 횟수 |

pk(userId, titleId). 도감 카운트 = count(*) / catalog 길이.

## daily_result — 정산 스냅샷

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| dailyRunId | uuid pk fk daily_run | |
| primaryTitleId | text null | 대표 칭호. 없으면 null |
| titleIds | text[] | 그날 부여된 전체 |
| rank | int | 나+친구 중 순위 |
| rankTotal | int | 나+친구 수 |
| settledAt | timestamptz | |

존재하면 그날은 정산된 것이고 `POST /api/taps` 는 409 를 돌려준다.
```

- [ ] **Step 3: `docs/goal.md` 열린 질문 절 교체**

```markdown
## 확정된 질문 (2026-09-19)

- 친구 추가 방식: **아이디 검색 후 즉시 등록** (`features.md` F0-2)
- 하루의 기준 시각: **KST 자정 고정** (`src/lib/kst.ts`)
- 실시간 전송 경로: `decisions/0002-realtime.md` A 안. 채널은 사용자당 하나 `u:{userId}`
- 로그인 식별자: 이메일이 아니라 **아이디** (`decisions/0005`)
```

같은 파일 "대회 목표" 의 `(이메일+비밀번호, 승인 없음)` 을 `(아이디+비밀번호, 승인 없음)` 으로 고친다.

- [ ] **Step 4: ADR 0005**

`docs/decisions/0005-username-login-and-title-catalog-in-code.md`:

```markdown
# ADR 0005 — 아이디 로그인, 칭호 마스터는 코드에

날짜: 2026-09-19 · 상태: 채택

## 결정 1 — 로그인 식별자는 아이디

better-auth `username` 플러그인을 켜고 `signIn.username` 으로 로그인한다. 코어 스키마가 `email` 을 필수로 요구하므로 가입 시 `${username}@id.tap-to-home.local` 을 자동 생성해 넣고 화면에는 보여주지 않는다. `emailAndPassword` 는 플러그인이 `/sign-up/email` 을 재사용하므로 켜 둔다.

- 이유: 심사 기간 개방형 로그인에서 이메일 입력은 마찰만 늘린다. 친구 검색 키도 아이디가 자연스럽다.
- 대안: 이메일 컬럼 제거 — better-auth 계약을 깨므로 기각. 익명 로그인 — 친구 검색 키가 없어 기각.

## 결정 2 — 칭호 마스터는 코드 상수

`src/features/titles/catalog.ts` 가 칭호 정의(id, 이름, 힌트, 포즈, 우선순위)의 단일 기준이다. `user_title.titleId`, `daily_result.primaryTitleId` 는 FK 없는 text. `title` 테이블은 만들지 않는다.

- 이유: 판정 로직이 코드에 있으므로 정의도 같은 곳에 있어야 함께 바뀐다. 50개로 늘려도 배포 한 번으로 끝난다.
- 결과: 칭호를 삭제할 때는 id 를 catalog 에서 지우지 말고 `retired: true` 를 붙여 기존 획득 기록이 깨지지 않게 한다 (필요해지면 필드 추가).
```

`docs/README.md` 의 decisions 행 끝에 `, 0004 손그림 UI, 0005 아이디 로그인·칭호 카탈로그` 를 붙인다.

- [ ] **Step 5: `schema.prisma` 갱신**

`User` 모델을 다음으로 교체하고, 파일 끝에 도메인 구역을 추가한다.

```prisma
model User {
  id              String    @id
  name            String
  email           String    @unique
  emailVerified   Boolean   @default(false)
  image           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  // username 플러그인 계약 (docs/decisions/0005)
  username        String?   @unique
  displayUsername String?
  sessions        Session[]
  accounts        Account[]

  friendshipsRequested Friendship[] @relation("FriendshipRequester")
  friendshipsReceived  Friendship[] @relation("FriendshipAddressee")
  dailyRuns            DailyRun[]
  signalsSent          Signal[]     @relation("SignalSender")
  signalsReceived      Signal[]     @relation("SignalReceiver")
  titles               UserTitle[]

  @@map("user")
}
```

파일 끝:

```prisma
// ───────────────────────────── friends ─────────────────────────────

enum FriendshipStatus {
  pending
  accepted
  blocked
}

model Friendship {
  id          String           @id @default(uuid())
  requesterId String
  addresseeId String
  status      FriendshipStatus @default(accepted)
  createdAt   DateTime         @default(now())
  requester   User             @relation("FriendshipRequester", fields: [requesterId], references: [id], onDelete: Cascade)
  addressee   User             @relation("FriendshipAddressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  @@unique([requesterId, addresseeId])
  @@index([addresseeId])
  @@map("friendship")
}

// ───────────────────────────── race ─────────────────────────────

model DailyRun {
  id         String       @id @default(uuid())
  userId     String
  runDate    DateTime     @db.Date
  tapCount   Int          @default(0)
  stage      Int          @default(0) @db.SmallInt
  firstTapAt DateTime?
  lastTapAt  DateTime?
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tapEvents  TapEvent[]
  result     DailyResult?

  @@unique([userId, runDate])
  @@index([runDate])
  @@map("daily_run")
}

model TapEvent {
  id         BigInt   @id @default(autoincrement())
  dailyRunId String
  tappedAt   DateTime @default(now())
  batchSize  Int      @db.SmallInt
  dailyRun   DailyRun @relation(fields: [dailyRunId], references: [id], onDelete: Cascade)

  @@index([dailyRunId])
  @@map("tap_event")
}

// ───────────────────────────── signal ─────────────────────────────

enum SignalLevel {
  normal
  strong
  urgent
  rescue
}

model Signal {
  id         String      @id @default(uuid())
  senderId   String
  receiverId String
  level      SignalLevel
  sentAt     DateTime    @default(now())
  readAt     DateTime?
  sender     User        @relation("SignalSender", fields: [senderId], references: [id], onDelete: Cascade)
  receiver   User        @relation("SignalReceiver", fields: [receiverId], references: [id], onDelete: Cascade)

  @@index([receiverId, sentAt])
  @@index([senderId, receiverId, level, sentAt])
  @@map("signal")
}

// ───────────────────────────── titles ─────────────────────────────
// 칭호 정의는 src/features/titles/catalog.ts (docs/decisions/0005). titleId 는 FK 없는 text.

model UserTitle {
  userId        String
  titleId       String
  firstEarnedOn DateTime @db.Date
  earnedCount   Int      @default(1)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, titleId])
  @@map("user_title")
}

model DailyResult {
  dailyRunId     String   @id
  primaryTitleId String?
  titleIds       String[]
  rank           Int
  rankTotal      Int
  settledAt      DateTime @default(now())
  dailyRun       DailyRun @relation(fields: [dailyRunId], references: [id], onDelete: Cascade)

  @@map("daily_result")
}
```

- [ ] **Step 6: 마이그레이션 생성·적용 (Supabase = `.env` 의 DIRECT_URL)**

```bash
pnpm db:migrate --name domain_init
```

Expected: `prisma/migrations/<ts>_domain_init/migration.sql` 생성, "Your database is now in sync", `prisma generate` 완료. `git status` 에 migration 파일과 `src/generated/` 변경(무시됨)만 보인다.

- [ ] **Step 7: 로컬 테스트 DB 에도 적용**

```bash
pnpm db:up
DIRECT_URL=postgresql://taptohome:taptohome@localhost:5432/taptohome pnpm --filter web db:deploy
```

Expected: 두 마이그레이션(`init`, `domain_init`) 적용.

- [ ] **Step 8: 타입 확인**

Run: `pnpm typecheck`
Expected: 통과 (better-auth 는 아직 `username` 을 모르지만 스키마에 nullable 이라 어댑터 충돌 없음).

- [ ] **Step 9: 커밋**

```bash
git add docs app/web/prisma
git commit -m "Add domain schema, username fields, and ADR 0005"
```

---

### Task 3: 아이디 로그인 (better-auth username 플러그인, 로그인·가입 화면, proxy)

**Files:**
- Modify: `app/web/src/lib/auth/server.ts`, `app/web/src/lib/auth/client.ts`
- Create: `app/web/src/lib/auth/placeholder-email.ts`, `app/web/src/lib/auth/placeholder-email.test.ts`, `app/web/src/lib/auth/current-user.ts`
- Create: `app/web/src/lib/api.ts`, `app/web/src/lib/fetch-json.ts`
- Create: `app/web/src/proxy.ts`
- Create: `app/web/src/components/text-field.tsx`
- Create: `app/web/src/app/(auth)/layout.tsx`, `app/web/src/app/(auth)/login/page.tsx`, `app/web/src/app/(auth)/login/login-form.tsx`, `app/web/src/app/(auth)/signup/page.tsx`, `app/web/src/app/(auth)/signup/signup-form.tsx`
- Modify: `app/web/src/app/dev/ui/page.tsx` (TextField 예시), `docs/design.md` (컴포넌트 표)

**Interfaces:**
- Produces: `placeholderEmail(username: string): string`; `getCurrentUser(headers: Headers): Promise<CurrentUser | null>`, `requireUser(headers: Headers): Promise<CurrentUser>` (route handler 용, throw), `requirePageUser(): Promise<CurrentUser>` (페이지용, 세션 없으면 `redirect("/login")`) with `type CurrentUser = { id: string; name: string; username: string }`; `jsonError(status: number, message: string): Response`, `parseJson<T>(request: Request, validate: (raw: unknown) => T | null): Promise<T | null>`; client `fetchJson<T>(url: string, init?: RequestInit): Promise<T>` throwing `ApiError { status: number; message: string }`; `TextField` props `{ label: string; hint?: string; error?: string } & input props`.

- [ ] **Step 1: placeholder email 테스트**

`app/web/src/lib/auth/placeholder-email.test.ts`:

```ts
import { expect, it } from "vitest";
import { placeholderEmail } from "./placeholder-email";

it("builds a lowercase placeholder email from the username", () => {
  expect(placeholderEmail("Seung_Gyu")).toBe("seung_gyu@id.tap-to-home.local");
  expect(placeholderEmail("  abc ")).toBe("abc@id.tap-to-home.local");
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test src/lib/auth`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`app/web/src/lib/auth/placeholder-email.ts`:

```ts
/**
 * better-auth 코어는 email 을 필수로 요구한다. 아이디 로그인만 쓰므로 아이디로 만든 자리표시 이메일을 넣는다.
 * 화면에는 절대 노출하지 않는다 (docs/decisions/0005).
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "id.tap-to-home.local";

export function placeholderEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test src/lib/auth`
Expected: PASS

- [ ] **Step 5: better-auth 서버·클라이언트에 플러그인 추가**

`app/web/src/lib/auth/server.ts` 의 `betterAuth({...})` 를 다음으로 교체:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/i;

// 서버 전용. 클라이언트 컴포넌트에서는 ./client 를 사용한다.
export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: ["https://*.vercel.app"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // 아이디 로그인(docs/decisions/0005). 플러그인이 /sign-up/email 을 재사용하므로 켜 둔다.
  // email 은 placeholderEmail() 로 자동 생성한다.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
    }),
    // server action / RSC 안에서 set-cookie 가 동작하도록. 반드시 plugins 배열의 마지막.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
```

`app/web/src/lib/auth/client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

- [ ] **Step 6: 현재 사용자 헬퍼와 API 유틸**

`app/web/src/lib/auth/current-user.ts`:

```ts
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; username: string };

/** route handler 는 request.headers, 서버 컴포넌트는 await headers() 를 넘긴다 */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
  };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요해요");
  }
}

export async function requireUser(headers: Headers): Promise<CurrentUser> {
  const user = await getCurrentUser(headers);
  if (!user) throw new UnauthorizedError();
  return user;
}

/** 서버 컴포넌트(페이지)용. 세션이 없으면 /login 으로 보낸다 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  return user;
}
```

`app/web/src/lib/api.ts` (route handler 공통):

```ts
/** route handler 의 오류 응답. 클라이언트 fetchJson 이 { error } 를 읽는다 */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** body 를 JSON 으로 읽고 validate 로 좁힌다. 실패하면 null */
export async function parseJson<T>(
  request: Request,
  validate: (raw: unknown) => T | null,
): Promise<T | null> {
  try {
    return validate(await request.json());
  } catch {
    return null;
  }
}
```

`app/web/src/lib/fetch-json.ts` (클라이언트):

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** same-origin API 호출. 실패 시 { error } 문구를 담은 ApiError 를 던진다 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  if (!res.ok) {
    let message = `요청에 실패했어요 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 본문 없음
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 7: proxy**

`app/web/src/proxy.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

/**
 * 낙관적 인증 검사: 세션 쿠키가 없으면 /login 으로. 실제 검증은 각 페이지·API 의 getSession.
 * /dev/ui 와 /api/auth 는 matcher 에 없으므로 통과한다.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/friends", "/today", "/collection", "/login", "/signup"],
};
```

- [ ] **Step 8: TextField 프리미티브**

`app/web/src/components/text-field.tsx`:

```tsx
import { useId, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  /** 라벨 옆 연한 안내 */
  hint?: string;
  /** 있으면 밑줄 아래 펜 글씨로 표시 */
  error?: string;
};

/** 줄노트 위에 쓰는 밑줄 입력칸. 높이 32px = 줄 한 칸 */
export function TextField({ label, hint, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      <span className="flex items-baseline gap-2 font-ui text-lg font-bold">
        {label}
        {hint && <span className="font-note text-base font-normal text-pencil-soft">{hint}</span>}
      </span>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "block h-8 w-full bg-transparent font-ui text-xl text-ink outline-none",
          "border-0 border-b-[1.5px] border-pencil rounded-none",
          "placeholder:text-pencil-soft focus-visible:border-marker focus-visible:border-b-[3px]",
          error && "border-margin",
        )}
        {...props}
      />
      {error && <span className="mt-1 block font-note text-base text-pencil">{error}</span>}
    </label>
  );
}
```

`app/web/src/app/dev/ui/page.tsx` 의 `SECTIONS` 에 `["inputs", "입력칸"]` 을 추가하고 버튼 섹션 다음에 아래 섹션을 넣는다 (파일 상단 import 에 `TextField` 추가):

```tsx
<Section id="inputs" title="입력칸" lead="줄 한 칸 높이의 밑줄. 오류는 여백선 색으로.">
  <div className="grid max-w-[320px] gap-4">
    <TextField label="아이디" hint="영문·숫자·_ 3~20자" placeholder="tap_to_home" />
    <TextField label="비밀번호" type="password" defaultValue="12345678" />
    <TextField label="닉네임" defaultValue="민경" error="이미 쓰는 아이디예요" />
  </div>
</Section>
```

`docs/design.md` 컴포넌트 표에 행 추가: `| TextField | 밑줄 입력칸. label, hint, error |`

- [ ] **Step 9: (auth) 레이아웃과 로그인·가입 화면**

`app/web/src/app/(auth)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Paper } from "@/components/paper";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-8">{children}</div>
    </Paper>
  );
}
```

`app/web/src/app/(auth)/login/page.tsx`:

```tsx
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <ScreenTitle>퇴근 레이스에 들어가기</ScreenTitle>
      <Note>아이디와 비밀번호만 있으면 돼요</Note>
      <LoginForm />
      <p className="mt-6 font-note text-xl text-pencil">
        처음이에요?{" "}
        <Link href="/signup" className="underline decoration-pencil underline-offset-4">
          아이디 만들기
        </Link>
      </p>
    </>
  );
}
```

`app/web/src/app/(auth)/login/login-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { signIn } from "@/lib/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await signIn.username({ username: username.trim(), password });
    setPending(false);
    if (error) {
      setError("아이디 또는 비밀번호가 틀렸어요");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <TextField
        label="아이디"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <TextField
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
        required
      />
      <MarkerButton type="submit" disabled={pending} className="mt-2">
        {pending ? "들어가는 중…" : "들어가기"}
      </MarkerButton>
    </form>
  );
}
```

`app/web/src/app/(auth)/signup/page.tsx`:

```tsx
import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <>
      <ScreenTitle>아이디 만들기</ScreenTitle>
      <Note>친구는 이 아이디로 나를 찾아요</Note>
      <SignupForm />
      <p className="mt-6 font-note text-xl text-pencil">
        이미 있어요?{" "}
        <Link href="/login" className="underline decoration-pencil underline-offset-4">
          들어가기
        </Link>
      </p>
    </>
  );
}
```

`app/web/src/app/(auth)/signup/signup-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MarkerButton } from "@/components/marker-button";
import { TextField } from "@/components/text-field";
import { signUp } from "@/lib/auth/client";
import { placeholderEmail } from "@/lib/auth/placeholder-email";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/i;

type FieldErrors = { username?: string; name?: string; password?: string };

function validate(username: string, name: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!USERNAME_PATTERN.test(username)) errors.username = "영문·숫자·_ 로 3~20자";
  if (name.length < 1 || name.length > 12) errors.name = "1~12자";
  if (password.length < 8) errors.password = "8자 이상";
  return errors;
}

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const next = validate(trimmedUsername, trimmedName, password);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const { error } = await signUp.email({
      email: placeholderEmail(trimmedUsername),
      password,
      name: trimmedName,
      username: trimmedUsername,
      displayUsername: trimmedUsername,
    });
    setPending(false);
    if (error) {
      setErrors({
        username:
          error.code === "USERNAME_IS_ALREADY_TAKEN" ? "이미 쓰는 아이디예요" : (error.message ?? "가입에 실패했어요"),
      });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
      <TextField
        label="아이디"
        hint="영문·숫자·_ 3~20자"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        required
      />
      <TextField
        label="닉네임"
        hint="레이스에서 보이는 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
      />
      <TextField
        label="비밀번호"
        hint="8자 이상"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
      />
      <MarkerButton type="submit" disabled={pending} className="mt-2">
        {pending ? "만드는 중…" : "만들고 시작하기"}
      </MarkerButton>
    </form>
  );
}
```

- [ ] **Step 10: 수동 확인**

```bash
pnpm dev
```

1. `http://localhost:3000/signup` 에서 아이디 `demo_a`, 닉네임 `민경`, 비밀번호 `password1` 가입 → `/` 로 이동(아직 옛 홈 화면).
2. Supabase Table Editor `user` 에 `username = demo_a`, `email = demo_a@id.tap-to-home.local`.
3. 같은 아이디로 다시 가입 → "이미 쓰는 아이디예요".
4. 시크릿 창 `http://localhost:3000/` → `/login` 으로 리다이렉트. `demo_a` 로 로그인 → `/`.
5. `/dev/ui#inputs` 에 TextField 3종.

- [ ] **Step 11: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: 모두 통과

```bash
git add app/web/src docs/design.md
git commit -m "Add username login with better-auth, auth screens, and proxy"
```

---

### Task 4: 앱 셸 (세션 레이아웃, 하단 탭, 자리표시 페이지)

**Files:**
- Delete: `app/web/src/app/page.tsx`
- Create: `app/web/src/components/bottom-nav.tsx`
- Create: `app/web/src/app/(app)/layout.tsx`, `app/web/src/app/(app)/page.tsx`, `app/web/src/app/(app)/friends/page.tsx`, `app/web/src/app/(app)/today/page.tsx`, `app/web/src/app/(app)/collection/page.tsx`
- Modify: `app/web/src/app/dev/ui/page.tsx`, `docs/design.md`

**Interfaces:**
- Produces: `BottomNav` (client, `usePathname`), `(app)/layout.tsx` 가 세션 없으면 `redirect("/login")`. 각 페이지는 `requirePageUser()` 로 `CurrentUser` 를 얻어 화면 컴포넌트에 props 로 넘긴다 (이후 태스크가 채움).

- [ ] **Step 1: BottomNav**

`app/web/src/components/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "레이스" },
  { href: "/friends", label: "친구" },
  { href: "/today", label: "오늘" },
  { href: "/collection", label: "도감" },
] as const;

/** 하단 탭. 활성 탭은 매직 밑줄. 형광펜은 화면 본문에 양보한다 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-marker bg-paper"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-14 max-w-[420px] grid-cols-4">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="grid place-items-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-2 py-1 font-ui text-xl leading-none",
                  active
                    ? "border-b-[3px] border-marker font-bold text-ink"
                    : "text-pencil-soft",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: (app) 레이아웃**

`app/web/src/app/(app)/layout.tsx`:

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Paper } from "@/components/paper";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  return (
    <Paper className="flex min-h-full flex-1 flex-col pb-20">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-3 pt-4">{children}</div>
      <BottomNav />
    </Paper>
  );
}
```

- [ ] **Step 3: 자리표시 페이지 4개**

`app/web/src/app/page.tsx` 삭제. 네 페이지 모두 같은 형태로 만든다. `app/web/src/app/(app)/page.tsx`:

```tsx
import { Note, ScreenTitle } from "@/components/paper";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RacePage() {
  const user = await requirePageUser();
  return (
    <>
      <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
      <Note>{user.name} · 레이스 준비 중</Note>
    </>
  );
}
```

`friends/page.tsx` 제목 "친구", `today/page.tsx` 제목 "오늘의 결과", `collection/page.tsx` 제목 "퇴근 도감". 각각 함수 이름 `FriendsPage`, `TodayPage`, `CollectionPage`.

- [ ] **Step 4: /dev/ui 와 design.md**

`app/web/src/app/dev/ui/page.tsx` 의 `SECTIONS` 에 `["nav", "하단 탭"]` 추가, 입력칸 섹션 뒤에:

```tsx
<Section id="nav" title="하단 탭" lead="활성 탭은 매직 밑줄. 화면 안에 붙박이로 보여주려고 position 만 풀었다.">
  <div className="relative h-16 w-[360px] [&_nav]:absolute">
    <BottomNav />
  </div>
</Section>
```

(import 에 `BottomNav` 추가. `BottomNav` 는 `fixed` 라 데모에서는 부모의 `[&_nav]:absolute` 로 덮어쓴다.)

`docs/design.md` 컴포넌트 표에 `| BottomNav | 하단 탭 4개. 활성 탭은 매직 밑줄 |` 추가. "화면 목록" 은 `docs/user-journey.md` 의 5개 항목을 `/`(메인+친구 레이스 합침)·`/friends`·`/today`·`/collection`·`/login`·`/signup` 로 갱신한다.

- [ ] **Step 5: 수동 확인**

`pnpm dev` → 로그인 후 `/` `/friends` `/today` `/collection` 이동 시 하단 탭 활성 표시가 바뀐다. 로그아웃 상태에서 `/friends` → `/login`.

- [ ] **Step 6: 검증·커밋**

Run: `pnpm typecheck && pnpm lint`

```bash
git add -A app/web/src docs
git commit -m "Add app shell with session layout and bottom navigation"
```

---

### Task 5: 레이스 서버 (탭 기록, 오늘 레이스 조회, API)

**Files:**
- Modify: `app/web/src/features/race/stages.ts` (`stageIndexOf`)
- Create: `app/web/src/features/race/race-state.ts`, `app/web/src/features/race/race-state.test.ts`
- Create: `app/web/test/db.ts`
- Create: `app/web/src/features/friends/server/list-friend-ids.ts`
- Create: `app/web/src/features/race/server/record-taps.ts`, `app/web/src/features/race/server/record-taps.test.ts`
- Create: `app/web/src/features/race/server/today.ts`, `app/web/src/features/race/server/today.test.ts`
- Create: `app/web/src/app/api/race/today/route.ts`, `app/web/src/app/api/taps/route.ts`

**Interfaces:**
- Consumes: `kstDate`, `todayKst`, `runDateToYmd` (Task 1); `getCurrentUser`, `jsonError`, `parseJson` (Task 3); Prisma 모델 (Task 2).
- Produces:
  - `stageIndexOf(count: number): number` (0~5)
  - `type Racer = { userId: string; name: string; username: string; tapCount: number; stage: number; isMe: boolean }`, `type RaceToday = { date: string; me: Racer; racers: Racer[]; settled: boolean }`
  - `sortRacers(racers: Racer[]): Racer[]`, `withRacerCount(data: RaceToday, userId: string, tapCount: number): RaceToday`
  - `listFriendIds(userId: string): Promise<string[]>`
  - `recordTaps(userId: string, count: number, now?: Date): Promise<{ tapCount: number; stage: number }>`, throws `RunSettledError`
  - `getRaceToday(user: CurrentUser, now?: Date): Promise<RaceToday>`
  - `createTestUser(prefix: string): Promise<{ id: string; name: string; username: string }>`, `deleteTestUsers(ids: string[]): Promise<void>`
  - `GET /api/race/today → RaceToday`, `POST /api/taps { count } → { tapCount, stage }` (409 정산됨, 400 잘못된 count)

- [ ] **Step 1: race-state 순수 함수 테스트**

`app/web/src/features/race/race-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stageIndexOf } from "./stages";
import { sortRacers, withRacerCount, type RaceToday, type Racer } from "./race-state";

const racer = (userId: string, tapCount: number, isMe = false): Racer => ({
  userId,
  name: userId,
  username: userId,
  tapCount,
  stage: stageIndexOf(tapCount),
  isMe,
});

describe("stageIndexOf", () => {
  it("maps thresholds to stage index", () => {
    expect(stageIndexOf(0)).toBe(0);
    expect(stageIndexOf(9)).toBe(0);
    expect(stageIndexOf(10)).toBe(1);
    expect(stageIndexOf(100)).toBe(5);
    expect(stageIndexOf(250)).toBe(5);
  });
});

describe("sortRacers", () => {
  it("sorts by tapCount desc, then name", () => {
    const sorted = sortRacers([racer("b", 5), racer("a", 5), racer("c", 9)]);
    expect(sorted.map((r) => r.userId)).toEqual(["c", "a", "b"]);
  });
});

describe("withRacerCount", () => {
  const data: RaceToday = {
    date: "2026-09-19",
    me: racer("me", 3, true),
    racers: [racer("f", 5), racer("me", 3, true)],
    settled: false,
  };

  it("updates me, stage, and re-sorts", () => {
    const next = withRacerCount(data, "me", 12);
    expect(next.me.tapCount).toBe(12);
    expect(next.me.stage).toBe(1);
    expect(next.racers.map((r) => r.userId)).toEqual(["me", "f"]);
    expect(data.me.tapCount).toBe(3); // 원본 불변
  });

  it("updates a friend without touching me", () => {
    const next = withRacerCount(data, "f", 40);
    expect(next.me.tapCount).toBe(3);
    expect(next.racers[0]).toMatchObject({ userId: "f", tapCount: 40, stage: 2 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test src/features/race/race-state.test.ts`
Expected: FAIL — `stageIndexOf` / `./race-state` 없음

- [ ] **Step 3: 구현**

`app/web/src/features/race/stages.ts` 끝에 추가:

```ts
/** DB 에 저장하는 단계 번호(0~5) */
export function stageIndexOf(count: number): number {
  return STAGES.indexOf(stageOf(count));
}
```

`app/web/src/features/race/race-state.ts`:

```ts
import { stageIndexOf } from "./stages";

/** GET /api/race/today 응답이자 클라이언트 캐시 형태 */
export type Racer = {
  userId: string;
  name: string;
  username: string;
  tapCount: number;
  stage: number;
  isMe: boolean;
};

export type RaceToday = {
  /** KST "YYYY-MM-DD" */
  date: string;
  me: Racer;
  /** 랭킹순 (나 포함) */
  racers: Racer[];
  /** 오늘 정산됨 → 탭 불가 */
  settled: boolean;
};

export function sortRacers(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => b.tapCount - a.tapCount || a.name.localeCompare(b.name, "ko"));
}

/** 한 명의 횟수를 바꾼 새 상태. 낙관적 업데이트와 실시간 이벤트가 같이 쓴다 */
export function withRacerCount(data: RaceToday, userId: string, tapCount: number): RaceToday {
  const patch = (r: Racer): Racer =>
    r.userId === userId ? { ...r, tapCount, stage: stageIndexOf(tapCount) } : r;
  return {
    ...data,
    me: patch(data.me),
    racers: sortRacers(data.racers.map(patch)),
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test src/features/race/race-state.test.ts`
Expected: PASS

- [ ] **Step 5: 테스트 DB 헬퍼와 친구 id 조회**

`app/web/test/db.ts`:

```ts
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { placeholderEmail } from "@/lib/auth/placeholder-email";

/** 통합 테스트용 사용자. 삭제하면 FK cascade 로 run/signal/friendship 이 함께 지워진다 */
export async function createTestUser(prefix: string): Promise<{ id: string; name: string; username: string }> {
  const id = randomUUID();
  const username = `${prefix}_${id.slice(0, 8)}`;
  const user = await prisma.user.create({
    data: { id, name: prefix, username, displayUsername: username, email: placeholderEmail(username) },
    select: { id: true, name: true },
  });
  return { id: user.id, name: user.name, username };
}

export async function deleteTestUsers(ids: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
```

`app/web/src/features/friends/server/list-friend-ids.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";

/** accepted 친구의 userId. 양방향 */
export async function listFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}
```

- [ ] **Step 6: recordTaps 통합 테스트**

`app/web/src/features/race/server/record-taps.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { RunSettledError, recordTaps } from "./record-taps";

const NOW = new Date("2026-09-19T01:00:00Z"); // 10:00 KST
let userId: string;

beforeAll(async () => {
  userId = (await createTestUser("taps")).id;
});
afterAll(async () => {
  await deleteTestUsers([userId]);
});

describe("recordTaps", () => {
  it("creates today's run on first batch and sets firstTapAt", async () => {
    const r = await recordTaps(userId, 3, NOW);
    expect(r).toEqual({ tapCount: 3, stage: 0 });
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
      include: { tapEvents: true },
    });
    expect(run.firstTapAt).toEqual(NOW);
    expect(run.tapEvents).toHaveLength(1);
    expect(run.tapEvents[0].batchSize).toBe(3);
  });

  it("increments atomically and advances stage", async () => {
    const later = new Date(NOW.getTime() + 60_000);
    const r = await recordTaps(userId, 8, later);
    expect(r).toEqual({ tapCount: 11, stage: 1 });
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
    });
    expect(run.stage).toBe(1);
    expect(run.firstTapAt).toEqual(NOW);
    expect(run.lastTapAt).toEqual(later);
  });

  it("rejects after the day is settled", async () => {
    const run = await prisma.dailyRun.findUniqueOrThrow({
      where: { userId_runDate: { userId, runDate: kstDate(NOW) } },
    });
    await prisma.dailyResult.create({
      data: { dailyRunId: run.id, titleIds: [], rank: 1, rankTotal: 1 },
    });
    await expect(recordTaps(userId, 1, NOW)).rejects.toBeInstanceOf(RunSettledError);
  });
});
```

- [ ] **Step 7: 실패 확인**

Run: `pnpm db:up && pnpm --filter web test src/features/race/server/record-taps.test.ts`
Expected: FAIL — `./record-taps` 없음

- [ ] **Step 8: recordTaps 구현**

`app/web/src/features/race/server/record-taps.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { stageIndexOf } from "../stages";

export class RunSettledError extends Error {
  constructor() {
    super("오늘은 이미 정산했어요");
  }
}

/**
 * 배치 탭 저장 (docs/decisions/0002 "탭 저장 규칙").
 * daily_run 을 upsert 하며 tap_count 를 원자적으로 올리고 tap_event 에 배치 1행을 남긴다.
 */
export async function recordTaps(
  userId: string,
  count: number,
  now: Date = new Date(),
): Promise<{ tapCount: number; stage: number }> {
  const runDate = kstDate(now);

  const settled = await prisma.dailyResult.findFirst({
    where: { dailyRun: { userId, runDate } },
    select: { dailyRunId: true },
  });
  if (settled) throw new RunSettledError();

  const run = await prisma.dailyRun.upsert({
    where: { userId_runDate: { userId, runDate } },
    create: {
      userId,
      runDate,
      tapCount: count,
      stage: stageIndexOf(count),
      firstTapAt: now,
      lastTapAt: now,
    },
    update: { tapCount: { increment: count }, lastTapAt: now },
    select: { id: true, tapCount: true, stage: true },
  });

  const stage = stageIndexOf(run.tapCount);
  await prisma.$transaction([
    prisma.tapEvent.create({ data: { dailyRunId: run.id, tappedAt: now, batchSize: count } }),
    ...(stage !== run.stage
      ? [prisma.dailyRun.update({ where: { id: run.id }, data: { stage } })]
      : []),
  ]);

  return { tapCount: run.tapCount, stage };
}
```

- [ ] **Step 9: 통과 확인**

Run: `pnpm --filter web test src/features/race/server/record-taps.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 10: getRaceToday 통합 테스트**

`app/web/src/features/race/server/today.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { recordTaps } from "./record-taps";
import { getRaceToday } from "./today";

const NOW = new Date("2026-09-19T02:00:00Z");
let me: { id: string; name: string; username: string };
let friend: { id: string; name: string; username: string };
let stranger: { id: string; name: string; username: string };

beforeAll(async () => {
  [me, friend, stranger] = await Promise.all([
    createTestUser("me"),
    createTestUser("friend"),
    createTestUser("stranger"),
  ]);
  await prisma.friendship.create({ data: { requesterId: friend.id, addresseeId: me.id } });
  await recordTaps(friend.id, 30, NOW);
  await recordTaps(stranger.id, 99, NOW);
});
afterAll(async () => {
  await deleteTestUsers([me.id, friend.id, stranger.id]);
});

describe("getRaceToday", () => {
  it("returns me (0 taps, no run yet) and accepted friends only, ranked", async () => {
    const data = await getRaceToday({ id: me.id, name: me.name, username: me.username }, NOW);
    expect(data.date).toBe("2026-09-19");
    expect(data.settled).toBe(false);
    expect(data.me).toMatchObject({ userId: me.id, tapCount: 0, stage: 0, isMe: true });
    expect(data.racers.map((r) => r.userId)).toEqual([friend.id, me.id]);
    expect(data.racers[0]).toMatchObject({ tapCount: 30, stage: 2, isMe: false, username: friend.username });
  });
});
```

- [ ] **Step 11: 실패 확인**

Run: `pnpm --filter web test src/features/race/server/today.test.ts`
Expected: FAIL — `./today` 없음

- [ ] **Step 12: getRaceToday 구현**

`app/web/src/features/race/server/today.ts`:

```ts
import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate, todayKst } from "@/lib/kst";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { sortRacers, type RaceToday, type Racer } from "../race-state";

/** 오늘(KST) 나+친구의 레이스 상태. 페이지 초기 데이터와 GET /api/race/today 가 같이 쓴다 */
export async function getRaceToday(user: CurrentUser, now: Date = new Date()): Promise<RaceToday> {
  const runDate = kstDate(now);
  const friendIds = await listFriendIds(user.id);

  const users = await prisma.user.findMany({
    where: { id: { in: [user.id, ...friendIds] } },
    select: {
      id: true,
      name: true,
      username: true,
      dailyRuns: {
        where: { runDate },
        select: { tapCount: true, stage: true, result: { select: { dailyRunId: true } } },
      },
    },
  });

  const racers: Racer[] = users.map((u) => ({
    userId: u.id,
    name: u.name,
    username: u.username ?? "",
    tapCount: u.dailyRuns[0]?.tapCount ?? 0,
    stage: u.dailyRuns[0]?.stage ?? 0,
    isMe: u.id === user.id,
  }));

  const sorted = sortRacers(racers);
  const me = sorted.find((r) => r.isMe) ?? {
    userId: user.id,
    name: user.name,
    username: user.username,
    tapCount: 0,
    stage: 0,
    isMe: true,
  };
  const settled = Boolean(users.find((u) => u.id === user.id)?.dailyRuns[0]?.result);

  return { date: todayKst(now), me, racers: sorted, settled };
}
```

- [ ] **Step 13: 통과 확인**

Run: `pnpm --filter web test src/features/race`
Expected: PASS

- [ ] **Step 14: route handlers**

`app/web/src/app/api/race/today/route.ts`:

```ts
import { getRaceToday } from "@/features/race/server/today";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json(await getRaceToday(user));
}
```

`app/web/src/app/api/taps/route.ts`:

```ts
import { RunSettledError, recordTaps } from "@/features/race/server/record-taps";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

// route.ts 는 핸들러 외 export 를 허용하지 않으므로 상수는 export 하지 않는다
const MAX_BATCH = 50;

function validateBody(raw: unknown): { count: number } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const count = (raw as { count?: unknown }).count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_BATCH) return null;
  return { count };
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");

  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "count 는 1~50 사이 정수여야 해요");

  try {
    return Response.json(await recordTaps(user.id, body.count));
  } catch (e) {
    if (e instanceof RunSettledError) return jsonError(409, e.message);
    throw e;
  }
}
```

- [ ] **Step 15: 수동 확인**

`pnpm dev` 후 로그인한 브라우저 콘솔에서:

```js
await fetch("/api/taps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: 12 }) }).then((r) => r.json());
// → { tapCount: 12, stage: 1 }
await fetch("/api/race/today").then((r) => r.json());
// → { date, me: { tapCount: 12, ... }, racers: [...], settled: false }
```

- [ ] **Step 16: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src app/web/test
git commit -m "Add race server: tap recording, today's race query, and API routes"
```

---

### Task 6: 레이스 클라이언트 (낙관적 탭, 배치 전송, 폴링 화면)

**Files:**
- Create: `app/web/src/features/race/tap-batcher.ts`, `app/web/src/features/race/tap-batcher.test.ts`
- Create: `app/web/src/features/race/hooks/use-race-today.ts`, `app/web/src/features/race/hooks/use-tap.ts`
- Create: `app/web/src/features/race/components/race-screen.tsx`
- Modify: `app/web/src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `RaceToday`, `withRacerCount`, `Racer` (Task 5); `getRaceToday` (Task 5, 서버 컴포넌트에서 초기 데이터); `fetchJson`, `ApiError` (Task 3); `StageStrip`, `RaceLane`, `StageTicks`, `TapButton` (기존).
- Produces:
  - `createTapBatcher(send: (count: number) => Promise<void>, options?: { delayMs?: number }): TapBatcher` with `TapBatcher = { tap(): void; pending(): number; flush(): Promise<void>; dispose(): void }`
  - `RACE_TODAY_KEY = ["race", "today"] as const`
  - `useRaceToday(initial: RaceToday, options: { polling: boolean }): UseQueryResult<RaceToday>`
  - `useTap(options: { onTap?: (at: number) => void }): { tap: () => void; frame: 0 | 1 }` — `onTap` 은 Task 8 이 연타 감지에 쓴다
  - `RaceScreen` props `{ initial: RaceToday }`

- [ ] **Step 1: tap-batcher 테스트**

`app/web/src/features/race/tap-batcher.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTapBatcher } from "./tap-batcher";

describe("createTapBatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collects taps within the delay into one send", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.tap();
    b.tap();
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(3);
    expect(b.pending()).toBe(0);
  });

  it("does not overlap sends; taps during a send go to the next batch", async () => {
    let resolveFirst!: () => void;
    const send = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (resolveFirst = r)))
      .mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledWith(1);
    b.tap();
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenCalledTimes(1); // 아직 첫 전송 중
    resolveFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(2);
  });

  it("re-queues the count when send fails", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("net")).mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(b.pending()).toBe(2);
    b.tap();
    await vi.advanceTimersByTimeAsync(300);
    expect(send).toHaveBeenLastCalledWith(3);
    expect(b.pending()).toBe(0);
  });

  it("dispose cancels the pending timer", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const b = createTapBatcher(send, { delayMs: 300 });
    b.tap();
    b.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test src/features/race/tap-batcher.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`app/web/src/features/race/tap-batcher.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test src/features/race/tap-batcher.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 훅**

`app/web/src/features/race/hooks/use-race-today.ts`:

```ts
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { RaceToday } from "../race-state";

export const RACE_TODAY_KEY = ["race", "today"] as const;
export const RACE_POLL_MS = 2000;

/**
 * 오늘 레이스 상태. polling=true 면 2초마다 refetch (Realtime 연결 전 B 안).
 * 서버 값이 낙관적 로컬 카운트보다 작으면(아직 배치 전송 전) 로컬 값을 유지한다.
 */
export function useRaceToday(initial: RaceToday, { polling }: { polling: boolean }) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: RACE_TODAY_KEY,
    initialData: initial,
    staleTime: 0,
    refetchInterval: polling ? RACE_POLL_MS : false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const fresh = await fetchJson<RaceToday>("/api/race/today");
      const prev = queryClient.getQueryData<RaceToday>(RACE_TODAY_KEY);
      if (!prev || prev.date !== fresh.date) return fresh;
      if (prev.me.tapCount <= fresh.me.tapCount) return fresh;
      // 로컬이 앞서 있음: 내 카운트만 로컬 값으로 되돌린다
      const keepMine = (r: RaceToday["racers"][number]) =>
        r.isMe ? { ...r, tapCount: prev.me.tapCount, stage: prev.me.stage } : r;
      return { ...fresh, me: keepMine(fresh.me), racers: fresh.racers.map(keepMine) };
    },
  });
}
```

`app/web/src/features/race/hooks/use-tap.ts`:

```ts
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { withRacerCount, type RaceToday } from "../race-state";
import { createTapBatcher } from "../tap-batcher";
import { RACE_TODAY_KEY } from "./use-race-today";

type TapResponse = { tapCount: number; stage: number };

/**
 * 탭 한 번 = 캐시의 내 카운트 +1 (즉시) + 프레임 토글 + 배치 전송.
 * 서버 응답으로 재동기화: 서버 누적 + 아직 안 보낸 탭.
 */
export function useTap({ onTap }: { onTap?: (at: number) => void } = {}) {
  const queryClient = useQueryClient();
  const [frame, setFrame] = useState<0 | 1>(0);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const batcherRef = useRef<ReturnType<typeof createTapBatcher> | null>(null);
  if (batcherRef.current === null) {
    batcherRef.current = createTapBatcher(async (count) => {
      try {
        const res = await fetchJson<TapResponse>("/api/taps", {
          method: "POST",
          body: JSON.stringify({ count }),
        });
        queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) => {
          if (!data) return data;
          const pending = batcherRef.current?.pending() ?? 0;
          return withRacerCount(data, data.me.userId, res.tapCount + pending);
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) =>
            data ? { ...data, settled: true } : data,
          );
          return; // 재시도하지 않는다
        }
        throw e; // batcher 가 다음 배치에 합친다
      }
    });
  }

  useEffect(() => {
    const batcher = batcherRef.current;
    return () => batcher?.dispose();
  }, []);

  const tap = useCallback(() => {
    const at = Date.now();
    setFrame((f) => (f === 0 ? 1 : 0));
    queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (data) =>
      data && !data.settled ? withRacerCount(data, data.me.userId, data.me.tapCount + 1) : data,
    );
    batcherRef.current?.tap();
    onTapRef.current?.(at);
  }, [queryClient]);

  return { tap, frame };
}
```

- [ ] **Step 6: RaceScreen**

`app/web/src/features/race/components/race-screen.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { TapButton } from "@/components/tap-button";
import { kstDateLabel } from "@/lib/kst";
import { useRaceToday } from "../hooks/use-race-today";
import { useTap } from "../hooks/use-tap";
import type { RaceToday } from "../race-state";
import { stageOf } from "../stages";
import { RaceLane, StageTicks } from "./race-lane";
import { StageStrip } from "./stage-strip";

export function RaceScreen({ initial }: { initial: RaceToday }) {
  const { data } = useRaceToday(initial, { polling: true });
  const { tap, frame } = useTap();
  const me = data.me;
  const friends = data.racers.filter((r) => !r.isMe);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
      <Note>
        {kstDateLabel(data.date)} · {data.settled ? "정산 완료" : `아직 ${stageOf(me.tapCount).label}`}
      </Note>

      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="tabular text-[88px] font-bold leading-[.9] tracking-tight">{me.tapCount}</span>
        <span className="text-[26px] font-bold">번</span>
      </div>

      <StageStrip count={me.tapCount} frame={frame} name={me.name} className="mt-4" />

      <div className="mt-3 flex flex-col items-center">
        <TapButton onTap={tap} disabled={data.settled} />
        <p className="mt-2 font-note text-[19px] text-pencil-soft">
          {data.settled ? (
            <Link href="/today" className="underline underline-offset-4">
              오늘은 정산했어요 · 결과 보기
            </Link>
          ) : (
            "꾹꾹 누르면 한 칸씩 간다"
          )}
        </p>
      </div>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <div>
            <ScreenTitle className="text-[22px]">오늘의 퇴근 레이스</ScreenTitle>
            <Note>누가 먼저 집에 갈까</Note>
          </div>
          <span className="inline-flex items-center gap-1.5 font-note text-[17px] text-pencil">
            <i className="h-2 w-2 animate-pulse rounded-full bg-marker" />
            2초마다 갱신
          </span>
        </div>

        {friends.length === 0 ? (
          <Note className="mt-4">
            아직 친구가 없어요.{" "}
            <Link href="/friends" className="underline underline-offset-4">
              아이디로 친구 등록하기
            </Link>
          </Note>
        ) : (
          <>
            <StageTicks className="mt-2" />
            {data.racers.map((r, i) => (
              <RaceLane
                key={r.userId}
                rank={i + 1}
                name={r.name}
                count={r.tapCount}
                isMe={r.isMe}
                frame={r.isMe ? frame : 0}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: 페이지 연결**

`app/web/src/app/(app)/page.tsx`:

```tsx
import { RaceScreen } from "@/features/race/components/race-screen";
import { getRaceToday } from "@/features/race/server/today";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RacePage() {
  const user = await requirePageUser();
  const initial = await getRaceToday(user);
  return <RaceScreen initial={initial} />;
}
```

- [ ] **Step 8: 수동 확인 (성공 기준 1)**

1. `pnpm dev`, 로그인 후 `/`. 버튼을 빠르게 20번 → 숫자가 즉시 오르고 졸라맨이 "엘베" 를 지나 "로비" 근처로 이동, 프레임이 번갈아 바뀐다.
2. 네트워크 탭: `/api/taps` 요청이 300ms 단위로 묶여 나간다 (20 요청이 아님).
3. 새로고침 → 횟수 유지.
4. 두 번째 계정을 시크릿 창에서 만들고 (Task 7 전이라 친구는 아직 없음) "아직 친구가 없어요" 안내가 보인다.

- [ ] **Step 9: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src
git commit -m "Add race screen with optimistic taps, batched sync, and polling"
```

---

### Task 7: 친구 등록 (아이디 검색, 목록, 화면)

**Files:**
- Create: `app/web/src/features/friends/server/friends.ts`, `app/web/src/features/friends/server/friends.test.ts`
- Create: `app/web/src/app/api/friends/route.ts`, `app/web/src/app/api/users/search/route.ts`
- Create: `app/web/src/features/friends/components/friends-screen.tsx`
- Modify: `app/web/src/app/(app)/friends/page.tsx`

**Interfaces:**
- Consumes: `listFriendIds` (Task 5), `kstDate` (Task 1), `getCurrentUser`, `jsonError`, `parseJson`, `fetchJson`, `TextField`, `RACE_TODAY_KEY`.
- Produces:
  - `type FriendSummary = { userId: string; username: string; name: string; tapCount: number }`
  - `type FoundUser = { id: string; username: string; name: string }`
  - `normalizeUsername(raw: string): string`
  - `listFriends(userId: string, now?: Date): Promise<FriendSummary[]>`
  - `searchUser(rawUsername: string, selfId: string): Promise<FoundUser | null>` (본인은 null)
  - `addFriend(userId: string, rawUsername: string, now?: Date): Promise<FriendSummary>` throws `FriendError` with `code: "self" | "not_found" | "already"`
  - `GET /api/friends → { friends: FriendSummary[] }`, `POST /api/friends { username } → { friend: FriendSummary }` (400 self, 404 not_found, 409 already), `GET /api/users/search?username= → { user: FoundUser | null }`
  - `FriendsScreen` props `{ me: { name: string; username: string }; initialFriends: FriendSummary[] }`

- [ ] **Step 1: 통합 테스트**

`app/web/src/features/friends/server/friends.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { recordTaps } from "@/features/race/server/record-taps";
import { FriendError, addFriend, listFriends, searchUser } from "./friends";

const NOW = new Date("2026-09-19T03:00:00Z");
let a: { id: string; username: string };
let b: { id: string; username: string };

beforeAll(async () => {
  [a, b] = await Promise.all([createTestUser("fa"), createTestUser("fb")]);
  await recordTaps(b.id, 7, NOW);
});
afterAll(async () => {
  await deleteTestUsers([a.id, b.id]);
});

describe("friends", () => {
  it("searchUser is case-insensitive and hides myself", async () => {
    expect(await searchUser(b.username.toUpperCase(), a.id)).toMatchObject({ id: b.id, username: b.username });
    expect(await searchUser(a.username, a.id)).toBeNull();
    expect(await searchUser("nobody_here_xyz", a.id)).toBeNull();
  });

  it("addFriend creates an accepted friendship visible from both sides", async () => {
    const friend = await addFriend(a.id, ` ${b.username.toUpperCase()} `, NOW);
    expect(friend).toMatchObject({ userId: b.id, username: b.username, tapCount: 7 });
    expect((await listFriends(a.id, NOW)).map((f) => f.userId)).toEqual([b.id]);
    expect((await listFriends(b.id, NOW)).map((f) => f.userId)).toEqual([a.id]);
  });

  it("rejects duplicates in either direction, self, and unknown ids", async () => {
    await expect(addFriend(b.id, a.username, NOW)).rejects.toMatchObject({ code: "already" });
    await expect(addFriend(a.id, a.username, NOW)).rejects.toMatchObject({ code: "self" });
    await expect(addFriend(a.id, "nobody_here_xyz", NOW)).rejects.toBeInstanceOf(FriendError);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test src/features/friends`
Expected: FAIL — `./friends` 없음

- [ ] **Step 3: 구현**

`app/web/src/features/friends/server/friends.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { listFriendIds } from "./list-friend-ids";

export type FriendSummary = { userId: string; username: string; name: string; tapCount: number };
export type FoundUser = { id: string; username: string; name: string };

export class FriendError extends Error {
  constructor(
    public code: "self" | "not_found" | "already",
    message: string,
  ) {
    super(message);
  }
}

/** better-auth username 플러그인과 같은 정규화 (소문자) */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function listFriends(userId: string, now: Date = new Date()): Promise<FriendSummary[]> {
  const ids = await listFriendIds(userId);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      username: true,
      dailyRuns: { where: { runDate: kstDate(now) }, select: { tapCount: true } },
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    userId: u.id,
    username: u.username ?? "",
    name: u.name,
    tapCount: u.dailyRuns[0]?.tapCount ?? 0,
  }));
}

export async function searchUser(rawUsername: string, selfId: string): Promise<FoundUser | null> {
  const username = normalizeUsername(rawUsername);
  if (!username) return null;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true },
  });
  if (!user || user.id === selfId) return null;
  return { id: user.id, username: user.username ?? "", name: user.name };
}

/** 아이디로 즉시 친구 등록 (F0-2). 수락 절차 없이 accepted */
export async function addFriend(
  userId: string,
  rawUsername: string,
  now: Date = new Date(),
): Promise<FriendSummary> {
  const username = normalizeUsername(rawUsername);
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, name: true },
  });
  if (!target) throw new FriendError("not_found", "그 아이디는 없어요");
  if (target.id === userId) throw new FriendError("self", "나 자신은 등록할 수 없어요");

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
    select: { id: true },
  });
  if (existing) throw new FriendError("already", "이미 친구예요");

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: target.id, status: "accepted" },
  });

  const run = await prisma.dailyRun.findUnique({
    where: { userId_runDate: { userId: target.id, runDate: kstDate(now) } },
    select: { tapCount: true },
  });
  return { userId: target.id, username: target.username ?? "", name: target.name, tapCount: run?.tapCount ?? 0 };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test src/features/friends`
Expected: PASS (3 tests)

- [ ] **Step 5: route handlers**

`app/web/src/app/api/friends/route.ts`:

```ts
import { FriendError, addFriend, listFriends } from "@/features/friends/server/friends";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const STATUS: Record<FriendError["code"], number> = { self: 400, not_found: 404, already: 409 };

function validateBody(raw: unknown): { username: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const username = (raw as { username?: unknown }).username;
  return typeof username === "string" && username.trim().length > 0 ? { username } : null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json({ friends: await listFriends(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "아이디를 입력해 주세요");
  try {
    return Response.json({ friend: await addFriend(user.id, body.username) });
  } catch (e) {
    if (e instanceof FriendError) return jsonError(STATUS[e.code], e.message);
    throw e;
  }
}
```

`app/web/src/app/api/users/search/route.ts`:

```ts
import { searchUser } from "@/features/friends/server/friends";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const username = new URL(request.url).searchParams.get("username") ?? "";
  return Response.json({ user: await searchUser(username, user.id) });
}
```

- [ ] **Step 6: FriendsScreen**

`app/web/src/features/friends/components/friends-screen.tsx`:

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { MarkerBox } from "@/components/marker-box";
import { MarkerButton } from "@/components/marker-button";
import { Note, ScreenTitle } from "@/components/paper";
import { TextField } from "@/components/text-field";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { RACE_TODAY_KEY } from "@/features/race/hooks/use-race-today";
import type { FoundUser, FriendSummary } from "../server/friends";

export const FRIENDS_KEY = ["friends"] as const;

type Props = { me: { name: string; username: string }; initialFriends: FriendSummary[] };

export function FriendsScreen({ me, initialFriends }: Props) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined); // undefined = 검색 전
  const [message, setMessage] = useState<string | null>(null);

  const friends = useQuery({
    queryKey: FRIENDS_KEY,
    initialData: initialFriends,
    queryFn: () => fetchJson<{ friends: FriendSummary[] }>("/api/friends").then((r) => r.friends),
  });

  const search = useMutation({
    mutationFn: (username: string) =>
      fetchJson<{ user: FoundUser | null }>(`/api/users/search?username=${encodeURIComponent(username)}`),
    onSuccess: ({ user }) => {
      setFound(user);
      setMessage(user ? null : "그 아이디는 없어요");
    },
    onError: (e) => setMessage(e instanceof ApiError ? e.message : "검색에 실패했어요"),
  });

  const add = useMutation({
    mutationFn: (username: string) =>
      fetchJson<{ friend: FriendSummary }>("/api/friends", {
        method: "POST",
        body: JSON.stringify({ username }),
      }),
    onSuccess: ({ friend }) => {
      setFound(undefined);
      setQuery("");
      setMessage(`${friend.name} 님과 친구가 됐어요`);
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
      queryClient.invalidateQueries({ queryKey: RACE_TODAY_KEY });
    },
    onError: (e) => setMessage(e instanceof ApiError ? e.message : "등록에 실패했어요"),
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setMessage(null);
    search.mutate(query.trim());
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>친구</ScreenTitle>
      <Note>
        내 아이디 <b className="font-ui text-ink">@{me.username}</b> · 친구에게 알려주세요
      </Note>

      <form onSubmit={handleSearch} className="mt-5 flex items-end gap-3">
        <TextField
          label="친구 아이디로 찾기"
          autoCapitalize="none"
          placeholder="friend_id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <MarkerButton type="submit" size="sm" disabled={search.isPending}>
          찾기
        </MarkerButton>
      </form>

      {found && (
        <MarkerBox lifted className="mt-4 flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-xl font-bold">{found.name}</div>
            <div className="font-note text-lg text-pencil">@{found.username}</div>
          </div>
          <MarkerButton size="sm" disabled={add.isPending} onClick={() => add.mutate(found.username)}>
            친구 등록
          </MarkerButton>
        </MarkerBox>
      )}
      {message && <Note className="mt-3">{message}</Note>}

      <section className="mt-8">
        <div className="flex items-baseline justify-between text-xl font-bold">
          <span>내 친구</span>
          <span className="tabular font-normal text-pencil">{friends.data.length}명</span>
        </div>
        {friends.data.length === 0 ? (
          <Note className="mt-2">아직 없어요. 위에서 아이디로 찾아 등록해요.</Note>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {friends.data.map((f) => (
              <li key={f.userId} className="flex h-8 items-center justify-between">
                <span>
                  <b>{f.name}</b>
                  <span className="ml-2 font-note text-lg text-pencil-soft">@{f.username}</span>
                </span>
                <span className="tabular text-pencil">오늘 {f.tapCount}번</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: 페이지 연결**

`app/web/src/app/(app)/friends/page.tsx`:

```tsx
import { FriendsScreen } from "@/features/friends/components/friends-screen";
import { listFriends } from "@/features/friends/server/friends";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function FriendsPage() {
  const user = await requirePageUser();
  const friends = await listFriends(user.id);
  return <FriendsScreen me={{ name: user.name, username: user.username }} initialFriends={friends} />;
}
```

- [ ] **Step 8: 수동 확인 (성공 기준 2 의 절반)**

1. 계정 A(일반 창)·B(시크릿 창) 로그인. A 의 `/friends` 에서 B 아이디 검색 → 카드 → "친구 등록" → "…님과 친구가 됐어요", 목록에 B.
2. B 의 `/friends` 새로고침 → A 가 목록에 있음.
3. 양쪽 `/` → 레이스 레인에 서로 보임. A 가 연타하면 2초 안에 B 화면의 A 졸라맨이 움직인다.
4. 다시 등록 → "이미 친구예요". 자기 아이디 검색 → "그 아이디는 없어요".

- [ ] **Step 9: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src
git commit -m "Add friend registration by username search"
```

---

### Task 8: 퇴근 신호 (연타 감지, 발송, 토스트)

**Files:**
- Create: `app/web/src/features/signal/combo.ts`, `app/web/src/features/signal/combo.test.ts`
- Create: `app/web/src/features/signal/messages.ts`, `app/web/src/features/signal/messages.test.ts`
- Create: `app/web/src/features/signal/server/signals.ts`, `app/web/src/features/signal/server/signals.test.ts`
- Create: `app/web/src/app/api/signals/route.ts`, `app/web/src/app/api/signals/unread/route.ts`
- Create: `app/web/src/features/signal/hooks/use-signal-toasts.ts`, `app/web/src/features/signal/components/signal-toast-layer.tsx`
- Modify: `app/web/src/features/race/components/race-screen.tsx`

**Interfaces:**
- Consumes: `SignalLevel` (`@/components/signal-toast`, 기존 — Prisma enum 과 같은 리터럴), `listFriendIds`, `useTap({ onTap })`, `SignalToast`.
- Produces:
  - `COMBO_WINDOW_MS = 1500`, `levelForTaps(taps: number): SignalLevel | null`, `createComboTracker(windowMs?: number): ComboTracker` with `ComboTracker = { tap(at: number): void; settle(now: number): SignalLevel | null; count(): number }`
  - `signalMessage(senderName: string, level: SignalLevel): { name: string; suffix: string; meta: string }`, `withJosa(word: string, withBatchim: string, withoutBatchim: string): string`
  - `type UnreadSignal = { id: string; senderName: string; level: SignalLevel; sentAt: string }`
  - `sendSignal(senderId: string, level: SignalLevel, now?: Date): Promise<{ delivered: string[] }>`, `SIGNAL_COOLDOWN_MS`
  - `takeUnreadSignals(receiverId: string, now?: Date): Promise<UnreadSignal[]>` (읽음 처리 포함)
  - `POST /api/signals { level } → { delivered: number }`, `GET /api/signals/unread → { signals: UnreadSignal[] }`
  - `useSignalToasts({ polling }: { polling: boolean }): { toasts: ToastItem[]; push: (s: UnreadSignal) => void }` with `ToastItem = UnreadSignal`
  - `SignalToastLayer` props `{ toasts: ToastItem[] }`

- [ ] **Step 1: combo 테스트**

`app/web/src/features/signal/combo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createComboTracker, levelForTaps } from "./combo";

describe("levelForTaps", () => {
  it("maps thresholds 1/5/10/30", () => {
    expect(levelForTaps(0)).toBeNull();
    expect(levelForTaps(1)).toBe("normal");
    expect(levelForTaps(4)).toBe("normal");
    expect(levelForTaps(5)).toBe("strong");
    expect(levelForTaps(10)).toBe("urgent");
    expect(levelForTaps(29)).toBe("urgent");
    expect(levelForTaps(30)).toBe("rescue");
  });
});

describe("createComboTracker", () => {
  it("groups taps within 1.5s and emits the highest level once", () => {
    const c = createComboTracker();
    for (let i = 0; i < 10; i++) c.tap(i * 100);
    expect(c.settle(1000)).toBeNull(); // 아직 창 안
    expect(c.settle(900 + 1500)).toBeNull(); // 경계: 마지막 탭 + 1500 은 아직 안 지남
    expect(c.settle(900 + 1501)).toBe("urgent");
    expect(c.settle(5000)).toBeNull(); // 한 번만
  });

  it("a gap over the window starts a new combo", () => {
    const c = createComboTracker();
    c.tap(0);
    c.tap(100);
    c.tap(2000); // 새 묶음
    expect(c.count()).toBe(1);
    expect(c.settle(3600)).toBe("normal");
  });

  it("emits normal for a single tap", () => {
    const c = createComboTracker();
    c.tap(0);
    expect(c.settle(1600)).toBe("normal");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter web test src/features/signal/combo.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: combo 구현**

`app/web/src/features/signal/combo.ts`:

```ts
import type { SignalLevel } from "@/components/signal-toast";

/** F2: 마지막 탭에서 1.5초 이내 연속 탭을 하나의 연타로 묶는다 */
export const COMBO_WINDOW_MS = 1500;

/** 연타 수 → 신호 등급. features.md F2 표 */
const THRESHOLDS: ReadonlyArray<{ level: SignalLevel; taps: number }> = [
  { level: "rescue", taps: 30 },
  { level: "urgent", taps: 10 },
  { level: "strong", taps: 5 },
  { level: "normal", taps: 1 },
];

export function levelForTaps(taps: number): SignalLevel | null {
  return THRESHOLDS.find((t) => taps >= t.taps)?.level ?? null;
}

export type ComboTracker = {
  tap(at: number): void;
  /** 창이 닫혔으면(마지막 탭 + windowMs 경과) 최고 등급을 한 번 돌려주고 초기화 */
  settle(now: number): SignalLevel | null;
  count(): number;
};

export function createComboTracker(windowMs: number = COMBO_WINDOW_MS): ComboTracker {
  let count = 0;
  let lastAt = -Infinity;

  return {
    tap(at) {
      count = at - lastAt > windowMs ? 1 : count + 1;
      lastAt = at;
    },
    settle(now) {
      if (count === 0 || now - lastAt <= windowMs) return null;
      const level = levelForTaps(count);
      count = 0;
      lastAt = -Infinity;
      return level;
    },
    count: () => count,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm --filter web test src/features/signal/combo.test.ts`
Expected: PASS

- [ ] **Step 5: messages 테스트**

`app/web/src/features/signal/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signalMessage, withJosa } from "./messages";

describe("withJosa", () => {
  it("picks 이/가 by final consonant", () => {
    expect(withJosa("수현", "이", "가")).toBe("수현이");
    expect(withJosa("민지", "이", "가")).toBe("민지가");
    expect(withJosa("Amy", "이", "가")).toBe("Amy가");
  });
});

describe("signalMessage", () => {
  it("builds the F2 copy per level", () => {
    expect(signalMessage("수현", "normal")).toEqual({ name: "수현", suffix: "이도 퇴근하고 싶어 해요", meta: "일반 신호" });
    expect(signalMessage("수현", "strong")).toEqual({ name: "수현", suffix: "이 강하게 퇴근하고 싶어 해요", meta: "5연타" });
    expect(signalMessage("민지", "urgent")).toEqual({ name: "민지", suffix: "가 긴급 퇴근 신호를 보냈어요!", meta: "10연타" });
    expect(signalMessage("민지", "rescue")).toEqual({ name: "민지", suffix: "가 구조 요청을 보냈어요!", meta: "30연타" });
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm --filter web test src/features/signal/messages.test.ts`
Expected: FAIL

- [ ] **Step 7: messages 구현**

`app/web/src/features/signal/messages.ts`:

```ts
import type { SignalLevel } from "@/components/signal-toast";

/** 마지막 글자가 한글이고 받침이 있으면 withBatchim, 아니면 withoutBatchim 을 붙인다 */
export function withJosa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const hasBatchim = isHangul && (code - 0xac00) % 28 !== 0;
  return `${word}${hasBatchim ? withBatchim : withoutBatchim}`;
}

/** 이름 뒤에 붙는 주격 조사만 */
function subjectJosa(name: string): string {
  return withJosa(name, "이", "가").slice(name.length);
}

const COPY: Record<SignalLevel, { suffix: (name: string) => string; meta: string }> = {
  normal: { suffix: () => "도 퇴근하고 싶어 해요", meta: "일반 신호" },
  strong: { suffix: (n) => `${subjectJosa(n)} 강하게 퇴근하고 싶어 해요`, meta: "5연타" },
  urgent: { suffix: (n) => `${subjectJosa(n)} 긴급 퇴근 신호를 보냈어요!`, meta: "10연타" },
  rescue: { suffix: (n) => `${subjectJosa(n)} 구조 요청을 보냈어요!`, meta: "30연타" },
};

/** 토스트 문구. name 은 <b> 로 감싸 강조하고 suffix 를 뒤에 붙인다 */
export function signalMessage(senderName: string, level: SignalLevel): { name: string; suffix: string; meta: string } {
  const c = COPY[level];
  return { name: senderName, suffix: c.suffix(senderName), meta: c.meta };
}
```

- [ ] **Step 8: 통과 확인**

Run: `pnpm --filter web test src/features/signal/messages.test.ts`
Expected: PASS

- [ ] **Step 9: 서버 통합 테스트**

`app/web/src/features/signal/server/signals.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { SIGNAL_COOLDOWN_MS, sendSignal, takeUnreadSignals } from "./signals";

const NOW = new Date("2026-09-19T04:00:00Z");
let s: { id: string; name: string };
let r1: { id: string };
let r2: { id: string };

beforeAll(async () => {
  [s, r1, r2] = await Promise.all([createTestUser("sender"), createTestUser("r1"), createTestUser("r2")]);
  await prisma.friendship.createMany({
    data: [
      { requesterId: s.id, addresseeId: r1.id },
      { requesterId: r2.id, addresseeId: s.id },
    ],
  });
});
afterAll(async () => {
  await deleteTestUsers([s.id, r1.id, r2.id]);
});

describe("sendSignal", () => {
  it("delivers to all friends once, then rate-limits the same level for 10 minutes", async () => {
    const first = await sendSignal(s.id, "urgent", NOW);
    expect(first.delivered.sort()).toEqual([r1.id, r2.id].sort());

    const again = await sendSignal(s.id, "urgent", new Date(NOW.getTime() + 60_000));
    expect(again.delivered).toEqual([]);

    const other = await sendSignal(s.id, "strong", new Date(NOW.getTime() + 60_000));
    expect(other.delivered).toHaveLength(2);

    const later = await sendSignal(s.id, "urgent", new Date(NOW.getTime() + SIGNAL_COOLDOWN_MS + 1));
    expect(later.delivered).toHaveLength(2);
  });
});

describe("takeUnreadSignals", () => {
  it("returns recent unread signals with sender name and marks them read", async () => {
    const at = new Date(NOW.getTime() + SIGNAL_COOLDOWN_MS + 1000);
    const unread = await takeUnreadSignals(r1.id, at);
    expect(unread.length).toBeGreaterThan(0);
    expect(unread[0]).toMatchObject({ senderName: s.name, level: expect.any(String) });
    expect(await takeUnreadSignals(r1.id, at)).toEqual([]);
  });
});
```

- [ ] **Step 10: 실패 확인**

Run: `pnpm --filter web test src/features/signal/server`
Expected: FAIL

- [ ] **Step 11: 서버 구현**

`app/web/src/features/signal/server/signals.ts`:

```ts
import "server-only";
import type { SignalLevel } from "@/components/signal-toast";
import { listFriendIds } from "@/features/friends/server/list-friend-ids";
import { prisma } from "@/lib/db";

/** 같은 등급은 같은 상대에게 10분에 한 번 (F2) */
export const SIGNAL_COOLDOWN_MS = 10 * 60 * 1000;
/** 이보다 오래된 미읽음 신호는 토스트로 띄우지 않는다 */
export const UNREAD_WINDOW_MS = 10 * 60 * 1000;

export type UnreadSignal = { id: string; senderName: string; level: SignalLevel; sentAt: string };

export async function sendSignal(
  senderId: string,
  level: SignalLevel,
  now: Date = new Date(),
): Promise<{ delivered: string[] }> {
  const friendIds = await listFriendIds(senderId);
  if (friendIds.length === 0) return { delivered: [] };

  const recent = await prisma.signal.findMany({
    where: {
      senderId,
      level,
      receiverId: { in: friendIds },
      sentAt: { gt: new Date(now.getTime() - SIGNAL_COOLDOWN_MS) },
    },
    select: { receiverId: true },
  });
  const cooling = new Set(recent.map((r) => r.receiverId));
  const delivered = friendIds.filter((id) => !cooling.has(id));
  if (delivered.length === 0) return { delivered };

  await prisma.signal.createMany({
    data: delivered.map((receiverId) => ({ senderId, receiverId, level, sentAt: now })),
  });
  return { delivered };
}

/** 최근 10분 내 미읽음 신호를 돌려주고 읽음 처리한다. 폴링 단계의 토스트 소스 */
export async function takeUnreadSignals(receiverId: string, now: Date = new Date()): Promise<UnreadSignal[]> {
  const rows = await prisma.signal.findMany({
    where: { receiverId, readAt: null, sentAt: { gt: new Date(now.getTime() - UNREAD_WINDOW_MS) } },
    orderBy: { sentAt: "asc" },
    select: { id: true, level: true, sentAt: true, sender: { select: { name: true } } },
  });
  if (rows.length === 0) return [];
  await prisma.signal.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { readAt: now } });
  return rows.map((r) => ({ id: r.id, senderName: r.sender.name, level: r.level, sentAt: r.sentAt.toISOString() }));
}
```

- [ ] **Step 12: 통과 확인**

Run: `pnpm --filter web test src/features/signal`
Expected: PASS

- [ ] **Step 13: route handlers**

`app/web/src/app/api/signals/route.ts`:

```ts
import type { SignalLevel } from "@/components/signal-toast";
import { sendSignal } from "@/features/signal/server/signals";
import { jsonError, parseJson } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

const LEVELS: readonly SignalLevel[] = ["normal", "strong", "urgent", "rescue"];

function validateBody(raw: unknown): { level: SignalLevel } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const level = (raw as { level?: unknown }).level;
  return LEVELS.includes(level as SignalLevel) ? { level: level as SignalLevel } : null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  const body = await parseJson(request, validateBody);
  if (!body) return jsonError(400, "level 이 잘못됐어요");
  const { delivered } = await sendSignal(user.id, body.level);
  return Response.json({ delivered: delivered.length });
}
```

`app/web/src/app/api/signals/unread/route.ts`:

```ts
import { takeUnreadSignals } from "@/features/signal/server/signals";
import { jsonError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return jsonError(401, "로그인이 필요해요");
  return Response.json({ signals: await takeUnreadSignals(user.id) });
}
```

- [ ] **Step 14: 토스트 훅과 레이어**

`app/web/src/features/signal/hooks/use-signal-toasts.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { UnreadSignal } from "../server/signals";

export const SIGNALS_UNREAD_KEY = ["signals", "unread"] as const;
export const SIGNAL_POLL_MS = 5000;
export const TOAST_TTL_MS = 4000;

export type ToastItem = UnreadSignal;

/**
 * 받은 신호 토스트 목록. polling=true 면 5초마다 미읽음을 가져온다 (서버가 읽음 처리).
 * Realtime 단계에서는 push() 로 직접 넣는다. 각 토스트는 4초 뒤 사라진다.
 */
export function useSignalToasts({ polling }: { polling: boolean }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((signal: ToastItem) => {
    setToasts((prev) => (prev.some((t) => t.id === signal.id) ? prev : [...prev, signal]));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== signal.id)), TOAST_TTL_MS);
  }, []);

  const unread = useQuery({
    queryKey: SIGNALS_UNREAD_KEY,
    enabled: polling,
    refetchInterval: polling ? SIGNAL_POLL_MS : false,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => fetchJson<{ signals: UnreadSignal[] }>("/api/signals/unread").then((r) => r.signals),
  });

  useEffect(() => {
    unread.data?.forEach(push);
  }, [unread.data, push]);

  return { toasts, push };
}
```

`app/web/src/features/signal/components/signal-toast-layer.tsx`:

```tsx
"use client";

import { SignalToast } from "@/components/signal-toast";
import type { ToastItem } from "../hooks/use-signal-toasts";
import { signalMessage } from "../messages";

/** 하단 탭 위에 떠 있는 신호 토스트. 최근 것이 아래 */
export function SignalToastLayer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-[420px] flex-col gap-2 px-3">
      {toasts.slice(-3).map((t) => {
        const m = signalMessage(t.senderName, t.level);
        return (
          <SignalToast key={t.id} level={t.level} meta={`${m.meta} · 방금`} className="pointer-events-auto shadow-paper">
            <b>{m.name}</b>
            {m.suffix}
          </SignalToast>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 15: RaceScreen 에 연결**

`app/web/src/features/race/components/race-screen.tsx` 를 수정한다. import 추가:

```tsx
import { useEffect, useRef } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { COMBO_WINDOW_MS, createComboTracker } from "@/features/signal/combo";
import { SignalToastLayer } from "@/features/signal/components/signal-toast-layer";
import { useSignalToasts } from "@/features/signal/hooks/use-signal-toasts";
```

컴포넌트 본문 앞부분을 다음으로 교체:

```tsx
export function RaceScreen({ initial }: { initial: RaceToday }) {
  const { data } = useRaceToday(initial, { polling: true });
  const { toasts } = useSignalToasts({ polling: true });

  // 연타 감지: 탭마다 창을 다시 열고, 창이 닫히면 최고 등급 하나만 보낸다 (F2)
  const combo = useRef(createComboTracker());
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = (at: number) => {
    combo.current.tap(at);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      const level = combo.current.settle(Date.now());
      if (level) {
        void fetchJson("/api/signals", { method: "POST", body: JSON.stringify({ level }) }).catch(() => {});
      }
    }, COMBO_WINDOW_MS + 50);
  };
  useEffect(() => () => {
    if (comboTimer.current) clearTimeout(comboTimer.current);
  }, []);

  const { tap, frame } = useTap({ onTap });
  const me = data.me;
  const friends = data.racers.filter((r) => !r.isMe);
```

그리고 반환 JSX 의 최상위 `<div className="flex flex-1 flex-col">` 마지막 자식으로 `<SignalToastLayer toasts={toasts} />` 를 추가한다.

- [ ] **Step 16: 수동 확인 (성공 기준 3)**

1. A·B 친구 상태에서 양쪽 `/`. B 가 10번 빠르게 연타 후 멈춤 → 1.5초 뒤 `POST /api/signals { level: "urgent" }` → A 화면에 5초 안에 형광펜 토스트 "**B닉네임**이 긴급 퇴근 신호를 보냈어요!".
2. B 가 곧바로 다시 10연타 → A 에 토스트 없음 (10분 쿨다운). 30연타 → "구조 요청" 토스트.
3. 탭 1번만 → A 에 "…도 퇴근하고 싶어 해요" (일반 신호). 10분 안에는 다시 안 뜸.

- [ ] **Step 17: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src
git commit -m "Add exit signals: combo detection, delivery with cooldown, and toasts"
```

---

### Task 9: 하루 결과 (칭호 판정, 정산, /today, /collection)

**Files:**
- Create: `app/web/src/features/titles/catalog.ts`
- Create: `app/web/src/features/titles/evaluate.ts`, `app/web/src/features/titles/evaluate.test.ts`
- Create: `app/web/src/features/titles/server/settle.ts`, `app/web/src/features/titles/server/settle.test.ts`
- Create: `app/web/src/features/titles/server/today-summary.ts`, `app/web/src/features/titles/server/collection.ts`
- Create: `app/web/src/features/titles/actions.ts`
- Create: `app/web/src/features/titles/components/today-result-card.tsx`
- Modify: `app/web/src/app/(app)/today/page.tsx`, `app/web/src/app/(app)/collection/page.tsx`

**Interfaces:**
- Consumes: `kstMinutes`, `kstHour`, `kstDate`, `todayKst`, `runDateToYmd`, `kstTimeLabel`, `kstDateLabel` (Task 1); `getRaceToday` (Task 5, 랭킹); `TitleBadge`, `Highlight`, `MarkerBox`, `MarkerButton`, `Stickman`.
- Produces:
  - `type TitleId = "heart_already_home" | "last_hour_sprinter" | "post_lunch_slump" | "early_leaver" | "bearable_day"`, `type TitleDef = { id: TitleId; name: string; hint: string; pose: StickmanPose; priority: number }`, `TITLES: readonly TitleDef[]`, `TITLE_BY_ID: Record<TitleId, TitleDef>`, `isTitleId(s: string): s is TitleId`
  - `type TapSample = { tappedAt: Date; batchSize: number }`, `evaluateTitles(input: { taps: TapSample[]; total: number; firstTapAt: Date | null }): TitleId[]`, `pickPrimary(ids: TitleId[]): TitleId | null`, `peakHour(taps: TapSample[]): number | null`
  - `settleToday(user: CurrentUser, now?: Date): Promise<SettleResult>` with `SettleResult = { alreadySettled: boolean; titleIds: TitleId[]; primaryTitleId: TitleId | null; newTitleIds: TitleId[]; rank: number; rankTotal: number }`
  - `getTodaySummary(user: CurrentUser, now?: Date): Promise<TodaySummary>` with `TodaySummary = { date: string; total: number; firstTapAt: string | null; peakHour: number | null; rank: number; rankTotal: number; result: { primaryTitleId: TitleId | null; titleIds: TitleId[]; newTitleIds: TitleId[] } | null }`
  - `getCollection(userId: string, now?: Date): Promise<{ earned: number; total: number; items: { def: TitleDef; earned: boolean; isNew: boolean }[] }>`
  - server action `settleTodayAction(): Promise<void>` (정산 후 `/today` 로 redirect)

- [ ] **Step 1: 카탈로그**

`app/web/src/features/titles/catalog.ts`:

```ts
import type { StickmanPose } from "@/components/stickman";

/**
 * 칭호 마스터 (docs/decisions/0005). DB 에는 id 만 저장한다.
 * priority 가 작을수록 대표 칭호로 먼저 뽑힌다. 조건은 evaluate.ts.
 */
export type TitleId =
  | "heart_already_home"
  | "last_hour_sprinter"
  | "post_lunch_slump"
  | "early_leaver"
  | "bearable_day";

export type TitleDef = {
  id: TitleId;
  name: string;
  /** 도감 미획득 칸의 힌트 */
  hint: string;
  pose: StickmanPose;
  priority: number;
};

export const TITLES: readonly TitleDef[] = [
  { id: "heart_already_home", name: "마음만 이미 집에 있음", hint: "하루 100번", pose: "lie", priority: 1 },
  { id: "last_hour_sprinter", name: "퇴근 1시간 전 폭주형", hint: "17시 이후 30번", pose: "run", priority: 2 },
  { id: "post_lunch_slump", name: "점심 먹고 모든 의욕을 잃은 자", hint: "오후에 몰아서", pose: "sit", priority: 3 },
  { id: "early_leaver", name: "출근하자마자 집 가고 싶었던 자", hint: "9시 반 전에 첫 탭", pose: "home", priority: 4 },
  { id: "bearable_day", name: "오늘은 버틸 만했던 자", hint: "10번 미만인 날", pose: "stand", priority: 5 },
];

export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t])) as Record<TitleId, TitleDef>;

export function isTitleId(s: string): s is TitleId {
  return s in TITLE_BY_ID;
}
```

- [ ] **Step 2: evaluate 테스트**

`app/web/src/features/titles/evaluate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateTitles, peakHour, pickPrimary, type TapSample } from "./evaluate";

/** "HH:MM" KST 에 n 탭 */
const at = (hhmm: string, batchSize: number): TapSample => {
  const [h, m] = hhmm.split(":").map(Number);
  return { tappedAt: new Date(Date.UTC(2026, 8, 19, h - 9, m)), batchSize };
};

describe("evaluateTitles", () => {
  it("early_leaver: first tap before 09:30 KST", () => {
    const taps = [at("09:29", 3), at("11:00", 7)];
    expect(evaluateTitles({ taps, total: 10, firstTapAt: taps[0].tappedAt })).toContain("early_leaver");
    const late = [at("09:30", 10)];
    expect(evaluateTitles({ taps: late, total: 10, firstTapAt: late[0].tappedAt })).not.toContain("early_leaver");
  });

  it("post_lunch_slump: 60%+ of taps at 13:00 or later", () => {
    const taps = [at("10:00", 4), at("14:00", 6)];
    expect(evaluateTitles({ taps, total: 10, firstTapAt: taps[0].tappedAt })).toContain("post_lunch_slump");
    const morning = [at("10:00", 5), at("14:00", 5)];
    expect(evaluateTitles({ taps: morning, total: 10, firstTapAt: morning[0].tappedAt })).not.toContain("post_lunch_slump");
  });

  it("last_hour_sprinter: 30+ taps at 17:00 or later", () => {
    const taps = [at("17:05", 30)];
    expect(evaluateTitles({ taps, total: 30, firstTapAt: taps[0].tappedAt })).toContain("last_hour_sprinter");
  });

  it("heart_already_home at 100, bearable_day under 10 (but not 0)", () => {
    const big = [at("12:00", 100)];
    expect(evaluateTitles({ taps: big, total: 100, firstTapAt: big[0].tappedAt })).toContain("heart_already_home");
    const small = [at("12:00", 9)];
    expect(evaluateTitles({ taps: small, total: 9, firstTapAt: small[0].tappedAt })).toContain("bearable_day");
    expect(evaluateTitles({ taps: [], total: 0, firstTapAt: null })).toEqual([]);
  });

  it("awards every matching title", () => {
    const taps = [at("09:00", 1), at("17:30", 99)];
    const ids = evaluateTitles({ taps, total: 100, firstTapAt: taps[0].tappedAt });
    expect(ids).toEqual(expect.arrayContaining(["early_leaver", "post_lunch_slump", "last_hour_sprinter", "heart_already_home"]));
    expect(ids).not.toContain("bearable_day");
  });
});

describe("pickPrimary", () => {
  it("chooses the lowest priority number", () => {
    expect(pickPrimary(["bearable_day", "early_leaver"])).toBe("early_leaver");
    expect(pickPrimary(["early_leaver", "heart_already_home"])).toBe("heart_already_home");
    expect(pickPrimary([])).toBeNull();
  });
});

describe("peakHour", () => {
  it("returns the KST hour with the most taps", () => {
    expect(peakHour([at("10:10", 3), at("16:20", 7), at("16:50", 2)])).toBe(16);
    expect(peakHour([])).toBeNull();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter web test src/features/titles/evaluate.test.ts`
Expected: FAIL

- [ ] **Step 4: evaluate 구현**

`app/web/src/features/titles/evaluate.ts`:

```ts
import { kstHour, kstMinutes } from "@/lib/kst";
import { TITLE_BY_ID, type TitleId } from "./catalog";

export type TapSample = { tappedAt: Date; batchSize: number };

export type EvaluateInput = {
  taps: TapSample[];
  /** daily_run.tapCount */
  total: number;
  firstTapAt: Date | null;
};

function sumWhere(taps: TapSample[], pred: (t: TapSample) => boolean): number {
  return taps.reduce((acc, t) => acc + (pred(t) ? t.batchSize : 0), 0);
}

/** F3-1 규칙. 조건이 여러 개 맞으면 모두. 탭이 없는 날은 칭호 없음 */
export function evaluateTitles({ taps, total, firstTapAt }: EvaluateInput): TitleId[] {
  if (total <= 0) return [];
  const ids: TitleId[] = [];

  if (firstTapAt && kstMinutes(firstTapAt) < 9 * 60 + 30) ids.push("early_leaver");
  if (sumWhere(taps, (t) => kstHour(t.tappedAt) >= 13) / total >= 0.6) ids.push("post_lunch_slump");
  if (sumWhere(taps, (t) => kstHour(t.tappedAt) >= 17) >= 30) ids.push("last_hour_sprinter");
  if (total >= 100) ids.push("heart_already_home");
  if (total < 10) ids.push("bearable_day");

  return ids;
}

/** 대표 칭호: priority 가 가장 작은 것 */
export function pickPrimary(ids: TitleId[]): TitleId | null {
  if (ids.length === 0) return null;
  return [...ids].sort((a, b) => TITLE_BY_ID[a].priority - TITLE_BY_ID[b].priority)[0];
}

/** 가장 많이 누른 KST 시각(0~23). 정산 화면 표시용 */
export function peakHour(taps: TapSample[]): number | null {
  if (taps.length === 0) return null;
  const byHour = new Map<number, number>();
  for (const t of taps) {
    const h = kstHour(t.tappedAt);
    byHour.set(h, (byHour.get(h) ?? 0) + t.batchSize);
  }
  return [...byHour.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter web test src/features/titles/evaluate.test.ts`
Expected: PASS

- [ ] **Step 6: settle 통합 테스트**

`app/web/src/features/titles/server/settle.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { recordTaps } from "@/features/race/server/record-taps";
import { createTestUser, deleteTestUsers } from "../../../../test/db";
import { getCollection } from "./collection";
import { settleToday } from "./settle";
import { getTodaySummary } from "./today-summary";

const MORNING = new Date("2026-09-19T00:00:00Z"); // 09:00 KST
const EVENING = new Date("2026-09-19T08:30:00Z"); // 17:30 KST
let me: { id: string; name: string; username: string };
let friend: { id: string };

beforeAll(async () => {
  [me, friend] = await Promise.all([createTestUser("settle"), createTestUser("sf")]);
  await prisma.friendship.create({ data: { requesterId: me.id, addresseeId: friend.id } });
  await recordTaps(me.id, 1, MORNING);
  await recordTaps(me.id, 99, EVENING);
  await recordTaps(friend.id, 150, EVENING);
});
afterAll(async () => {
  await deleteTestUsers([me.id, friend.id]);
});

describe("settleToday", () => {
  it("awards titles, writes user_title and daily_result, ranks among friends", async () => {
    const user = { id: me.id, name: me.name, username: me.username };
    const r = await settleToday(user, EVENING);
    expect(r.alreadySettled).toBe(false);
    expect(r.titleIds).toEqual(
      expect.arrayContaining(["early_leaver", "post_lunch_slump", "last_hour_sprinter", "heart_already_home"]),
    );
    expect(r.primaryTitleId).toBe("heart_already_home");
    expect(r.newTitleIds).toEqual(r.titleIds); // 전부 처음
    expect(r).toMatchObject({ rank: 2, rankTotal: 2 });

    const result = await prisma.dailyResult.findFirstOrThrow({ where: { dailyRun: { userId: me.id, runDate: kstDate(EVENING) } } });
    expect(result.primaryTitleId).toBe("heart_already_home");

    const again = await settleToday(user, EVENING);
    expect(again.alreadySettled).toBe(true);
    expect(again.titleIds).toEqual(r.titleIds);
  });

  it("today summary and collection reflect the settlement", async () => {
    const summary = await getTodaySummary({ id: me.id, name: me.name, username: me.username }, EVENING);
    expect(summary).toMatchObject({ total: 100, rank: 2, rankTotal: 2, peakHour: 17 });
    expect(summary.firstTapAt).toBe("09:00");
    expect(summary.result?.primaryTitleId).toBe("heart_already_home");

    const collection = await getCollection(me.id, EVENING);
    expect(collection.total).toBe(5);
    expect(collection.earned).toBe(4);
    expect(collection.items.find((i) => i.def.id === "heart_already_home")).toMatchObject({ earned: true, isNew: true });
    expect(collection.items.find((i) => i.def.id === "bearable_day")).toMatchObject({ earned: false, isNew: false });
  });
});
```

- [ ] **Step 7: 실패 확인**

Run: `pnpm --filter web test src/features/titles/server`
Expected: FAIL

- [ ] **Step 8: settle / today-summary / collection 구현**

`app/web/src/features/titles/server/settle.ts`:

```ts
import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { getRaceToday } from "@/features/race/server/today";
import { isTitleId, type TitleId } from "../catalog";
import { evaluateTitles, pickPrimary } from "../evaluate";

export type SettleResult = {
  alreadySettled: boolean;
  titleIds: TitleId[];
  primaryTitleId: TitleId | null;
  /** 오늘 처음 얻은 것 (도감 NEW) */
  newTitleIds: TitleId[];
  rank: number;
  rankTotal: number;
};

function toTitleIds(ids: string[]): TitleId[] {
  return ids.filter(isTitleId);
}

/** "오늘 정산" (F3). 한 번만 실행되고, 이미 정산됐으면 저장된 결과를 돌려준다 */
export async function settleToday(user: CurrentUser, now: Date = new Date()): Promise<SettleResult> {
  const runDate = kstDate(now);

  const run = await prisma.dailyRun.upsert({
    where: { userId_runDate: { userId: user.id, runDate } },
    create: { userId: user.id, runDate },
    update: {},
    include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
  });

  if (run.result) {
    const titleIds = toTitleIds(run.result.titleIds);
    const newRows = await prisma.userTitle.findMany({
      where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
      select: { titleId: true },
    });
    return {
      alreadySettled: true,
      titleIds,
      primaryTitleId: run.result.primaryTitleId && isTitleId(run.result.primaryTitleId) ? run.result.primaryTitleId : null,
      newTitleIds: toTitleIds(newRows.map((r) => r.titleId)),
      rank: run.result.rank,
      rankTotal: run.result.rankTotal,
    };
  }

  const titleIds = evaluateTitles({ taps: run.tapEvents, total: run.tapCount, firstTapAt: run.firstTapAt });
  const primaryTitleId = pickPrimary(titleIds);

  const race = await getRaceToday(user, now);
  const rank = race.racers.findIndex((r) => r.isMe) + 1;
  const rankTotal = race.racers.length;

  const existing = await prisma.userTitle.findMany({
    where: { userId: user.id, titleId: { in: titleIds } },
    select: { titleId: true },
  });
  const owned = new Set(existing.map((e) => e.titleId));
  const newTitleIds = titleIds.filter((id) => !owned.has(id));

  await prisma.$transaction([
    ...titleIds.map((titleId) =>
      prisma.userTitle.upsert({
        where: { userId_titleId: { userId: user.id, titleId } },
        create: { userId: user.id, titleId, firstEarnedOn: runDate, earnedCount: 1 },
        update: { earnedCount: { increment: 1 } },
      }),
    ),
    prisma.dailyResult.create({
      data: { dailyRunId: run.id, primaryTitleId, titleIds, rank, rankTotal },
    }),
  ]);

  return { alreadySettled: false, titleIds, primaryTitleId, newTitleIds, rank, rankTotal };
}
```

`app/web/src/features/titles/server/today-summary.ts`:

```ts
import "server-only";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { kstDate, kstTimeLabel, todayKst } from "@/lib/kst";
import { getRaceToday } from "@/features/race/server/today";
import { isTitleId, type TitleId } from "../catalog";
import { peakHour } from "../evaluate";

export type TodaySummary = {
  date: string;
  total: number;
  /** "09:32" */
  firstTapAt: string | null;
  peakHour: number | null;
  rank: number;
  rankTotal: number;
  result: { primaryTitleId: TitleId | null; titleIds: TitleId[]; newTitleIds: TitleId[] } | null;
};

/** /today 화면 데이터. 정산 전에는 result 가 null */
export async function getTodaySummary(user: CurrentUser, now: Date = new Date()): Promise<TodaySummary> {
  const runDate = kstDate(now);
  const [run, race] = await Promise.all([
    prisma.dailyRun.findUnique({
      where: { userId_runDate: { userId: user.id, runDate } },
      include: { result: true, tapEvents: { select: { tappedAt: true, batchSize: true } } },
    }),
    getRaceToday(user, now),
  ]);

  let result: TodaySummary["result"] = null;
  if (run?.result) {
    const titleIds = run.result.titleIds.filter(isTitleId);
    const newRows = await prisma.userTitle.findMany({
      where: { userId: user.id, titleId: { in: titleIds }, firstEarnedOn: runDate },
      select: { titleId: true },
    });
    result = {
      primaryTitleId: run.result.primaryTitleId && isTitleId(run.result.primaryTitleId) ? run.result.primaryTitleId : null,
      titleIds,
      newTitleIds: newRows.map((r) => r.titleId).filter(isTitleId),
    };
  }

  return {
    date: todayKst(now),
    total: run?.tapCount ?? 0,
    firstTapAt: run?.firstTapAt ? kstTimeLabel(run.firstTapAt) : null,
    peakHour: peakHour(run?.tapEvents ?? []),
    rank: race.racers.findIndex((r) => r.isMe) + 1,
    rankTotal: race.racers.length,
    result,
  };
}
```

`app/web/src/features/titles/server/collection.ts`:

```ts
import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { TITLES, type TitleDef } from "../catalog";

export type CollectionItem = { def: TitleDef; earned: boolean; isNew: boolean };

/** 도감 (F3-2). 카탈로그 순서대로, 오늘 처음 얻은 것은 isNew */
export async function getCollection(userId: string, now: Date = new Date()) {
  const today = kstDate(now);
  const rows = await prisma.userTitle.findMany({
    where: { userId },
    select: { titleId: true, firstEarnedOn: true },
  });
  const byId = new Map(rows.map((r) => [r.titleId, r]));
  const items: CollectionItem[] = TITLES.map((def) => {
    const row = byId.get(def.id);
    return { def, earned: Boolean(row), isNew: row?.firstEarnedOn.getTime() === today.getTime() };
  });
  return { earned: items.filter((i) => i.earned).length, total: TITLES.length, items };
}
```

- [ ] **Step 9: 통과 확인**

Run: `pnpm --filter web test src/features/titles`
Expected: PASS

- [ ] **Step 10: server action 과 결과 카드**

`app/web/src/features/titles/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { settleToday } from "./server/settle";

/** /today 의 "오늘 정산" 버튼 */
export async function settleTodayAction(): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  await settleToday(user);
  revalidatePath("/today");
  revalidatePath("/collection");
  revalidatePath("/");
  redirect("/today");
}
```

`app/web/src/features/titles/components/today-result-card.tsx`:

```tsx
import { Highlight } from "@/components/highlight";
import { MarkerBox } from "@/components/marker-box";
import { Stickman } from "@/components/stickman";
import { TITLE_BY_ID } from "../catalog";
import type { TodaySummary } from "../server/today-summary";

/** 정산 카드. result 가 null 이면 정산 전 요약만 */
export function TodayResultCard({ summary }: { summary: TodaySummary }) {
  const primary = summary.result?.primaryTitleId ? TITLE_BY_ID[summary.result.primaryTitleId] : null;
  const peak = summary.peakHour === null ? "–" : `${String(summary.peakHour).padStart(2, "0")}:00 – ${String(summary.peakHour + 1).padStart(2, "0")}:00`;

  return (
    <MarkerBox className="mt-3 px-4 pb-3 pt-3.5 text-center">
      <div className="font-note text-lg text-pencil-soft">
        {summary.result ? "오늘의 대표 칭호" : "정산하면 칭호가 정해져요"}
      </div>
      <div className="my-1 text-[30px] font-bold leading-[1.1] text-balance">
        {primary ? (
          <Highlight className="px-1.5">{primary.name}</Highlight>
        ) : (
          <span className="text-pencil-soft">{summary.result ? "칭호 없음 · 내일 다시" : "?"}</span>
        )}
      </div>
      <div className="flex h-[84px] items-end justify-center">
        <Stickman pose={primary?.pose ?? "stand"} size={44} thick />
      </div>
      <dl className="mt-2.5 grid grid-cols-[1fr_auto] gap-y-0.5 text-left text-lg">
        <dt className="text-pencil">총 횟수</dt>
        <dd className="tabular text-right font-bold">{summary.total}번</dd>
        <dt className="text-pencil">첫 퇴근 욕구</dt>
        <dd className="tabular text-right font-bold">{summary.firstTapAt ?? "–"}</dd>
        <dt className="text-pencil">가장 많이 누른 시간</dt>
        <dd className="tabular text-right font-bold">{peak}</dd>
        <dt className="text-pencil">오늘 랭킹</dt>
        <dd className="tabular text-right font-bold">
          {summary.rank}위 / {summary.rankTotal}명
        </dd>
      </dl>
    </MarkerBox>
  );
}
```

- [ ] **Step 11: /today 와 /collection 페이지**

`app/web/src/app/(app)/today/page.tsx`:

```tsx
import Link from "next/link";
import { MarkerButton } from "@/components/marker-button";
import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { settleTodayAction } from "@/features/titles/actions";
import { TITLE_BY_ID } from "@/features/titles/catalog";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { getTodaySummary } from "@/features/titles/server/today-summary";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function TodayPage() {
  const user = await requirePageUser();
  const summary = await getTodaySummary(user);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>{summary.result ? "오늘도 수고했어요" : "오늘의 결과"}</ScreenTitle>
      <Note>
        {kstDateLabel(summary.date)} · {summary.result ? "정산 완료" : "정산 전"}
      </Note>

      <TodayResultCard summary={summary} />

      {summary.result ? (
        <>
          <div className="mt-4 flex items-baseline justify-between text-xl font-bold">
            <span>오늘 얻은 칭호</span>
            <span className="tabular">{summary.result.titleIds.length}개</span>
          </div>
          {summary.result.titleIds.length === 0 ? (
            <Note className="mt-2">오늘은 조건에 맞는 칭호가 없었어요</Note>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {summary.result.titleIds.map((id) => (
                <TitleBadge
                  key={id}
                  name={TITLE_BY_ID[id].name}
                  pose={TITLE_BY_ID[id].pose}
                  isNew={summary.result!.newTitleIds.includes(id)}
                />
              ))}
            </div>
          )}
          <div className="mt-auto pt-6">
            <Link
              href="/collection"
              className="mk mk-pill block px-4 py-2.5 text-center font-ui text-xl font-bold text-ink"
            >
              도감 전체 보기
            </Link>
          </div>
        </>
      ) : (
        <form action={settleTodayAction} className="mt-auto pt-6">
          <Note className="mb-3">정산하면 오늘은 더 누를 수 없어요. 퇴근 직전에 눌러요.</Note>
          <MarkerButton type="submit" className="w-full">
            오늘 정산
          </MarkerButton>
        </form>
      )}
    </div>
  );
}
```

`app/web/src/app/(app)/collection/page.tsx`:

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

- [ ] **Step 12: 수동 확인 (성공 기준 4)**

1. A 로 `/` 에서 100번 이상 탭 → `/today` 에 총 횟수·첫 탭·랭킹 요약과 "오늘 정산" 버튼.
2. "오늘 정산" → 대표 칭호에 형광펜, 칭호 뱃지에 NEW, `/collection` 카운트 `n / 5`, NEW 표시.
3. `/` 로 돌아오면 버튼이 점선(비활성)이고 "오늘은 정산했어요 · 결과 보기".
4. `/today` 를 다시 열어도 같은 결과(재정산 없음).

- [ ] **Step 13: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src
git commit -m "Add daily settlement with title evaluation, today screen, and collection"
```

---

### Task 10: Supabase Realtime 으로 폴링 대체

**Files:**
- Create: `app/web/src/features/realtime/channels.ts`
- Create: `app/web/src/features/realtime/server/broadcast.ts`
- Create: `app/web/src/features/realtime/hooks/use-race-realtime.ts`
- Modify: `app/web/src/app/api/taps/route.ts`, `app/web/src/app/api/signals/route.ts`
- Modify: `app/web/src/features/race/components/race-screen.tsx`
- Modify: `docs/decisions/0002-realtime.md` (채널 이름 확정 한 줄)

**Interfaces:**
- Consumes: `getSupabaseRealtime()` (browser), `getSupabaseAdmin()` (server) — 기존 `src/lib/supabase/*`; `withRacerCount`, `RACE_TODAY_KEY`, `useSignalToasts().push`, `sendSignal` 의 `delivered`.
- Produces:
  - `userChannel(userId: string): string` (`u:{userId}`), `RACE_EVENT = "race"`, `SIGNAL_EVENT = "signal"`, `type RacePayload = { userId: string; date: string; tapCount: number; stage: number }`, `type SignalPayload = { id: string; senderName: string; level: SignalLevel; sentAt: string }`
  - `broadcast(channel: string, event: string, payload: unknown): Promise<void>` (실패해도 throw 하지 않음)
  - `useRaceRealtime(opts: { myId: string; friendIds: string[]; onRace: (p: RacePayload) => void; onSignal: (p: SignalPayload) => void }): { connected: boolean }`

- [ ] **Step 1: 채널 정의**

`app/web/src/features/realtime/channels.ts`:

```ts
import type { SignalLevel } from "@/components/signal-toast";

/**
 * 사용자당 채널 하나 (docs/decisions/0002). 내 채널에는 내 race 갱신과 나에게 온 signal 이 흐른다.
 * 클라이언트는 내 채널 + 친구 채널을 구독한다. 개방형 데모라 public 채널.
 */
export function userChannel(userId: string): string {
  return `u:${userId}`;
}

export const RACE_EVENT = "race";
export const SIGNAL_EVENT = "signal";

export type RacePayload = { userId: string; date: string; tapCount: number; stage: number };
export type SignalPayload = { id: string; senderName: string; level: SignalLevel; sentAt: string };
```

- [ ] **Step 2: 서버 브로드캐스트**

`app/web/src/features/realtime/server/broadcast.ts`:

```ts
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** REST 로 채널에 한 번 쏜다. 키가 없거나 실패해도 요청 자체는 성공시킨다 (폴링이 받쳐준다) */
export async function broadcast(channel: string, event: string, payload: unknown): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const supabase = getSupabaseAdmin();
  const ch = supabase.channel(channel);
  try {
    const result = await ch.httpSend(event, payload, { timeout: 2000 });
    if (!result.success) console.warn(`[realtime] broadcast ${channel}/${event} failed: ${result.status} ${result.error}`);
  } catch (e) {
    console.warn(`[realtime] broadcast ${channel}/${event} threw`, e);
  } finally {
    await supabase.removeChannel(ch);
  }
}
```

- [ ] **Step 3: taps / signals 라우트에서 브로드캐스트**

`app/web/src/app/api/taps/route.ts` — import 추가:

```ts
import { after } from "next/server";
import { RACE_EVENT, userChannel, type RacePayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
import { todayKst } from "@/lib/kst";
```

`try` 블록을 다음으로 교체:

```ts
  try {
    const result = await recordTaps(user.id, body.count);
    const payload: RacePayload = { userId: user.id, date: todayKst(), ...result };
    // 응답을 먼저 보내고 브로드캐스트 (Vercel 은 after() 완료까지 함수를 유지한다)
    after(() => broadcast(userChannel(user.id), RACE_EVENT, payload));
    return Response.json(result);
  } catch (e) {
```

`app/web/src/app/api/signals/route.ts` — import 추가:

```ts
import { after } from "next/server";
import { SIGNAL_EVENT, userChannel, type SignalPayload } from "@/features/realtime/channels";
import { broadcast } from "@/features/realtime/server/broadcast";
```

마지막 두 줄을 다음으로 교체:

```ts
  const { delivered } = await sendSignal(user.id, body.level);
  const sentAt = new Date().toISOString();
  after(() =>
    Promise.all(
      delivered.map((receiverId) => {
        const payload: SignalPayload = { id: `${user.id}:${sentAt}`, senderName: user.name, level: body.level, sentAt };
        return broadcast(userChannel(receiverId), SIGNAL_EVENT, payload);
      }),
    ),
  );
  return Response.json({ delivered: delivered.length });
```

- [ ] **Step 4: 클라이언트 구독 훅**

`app/web/src/features/realtime/hooks/use-race-realtime.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseRealtime } from "@/lib/supabase/client";
import { RACE_EVENT, SIGNAL_EVENT, userChannel, type RacePayload, type SignalPayload } from "../channels";

type Options = {
  myId: string;
  friendIds: string[];
  onRace: (payload: RacePayload) => void;
  onSignal: (payload: SignalPayload) => void;
};

/**
 * 내 채널(signal) + 친구 채널(race) 구독. 내 채널이 SUBSCRIBED 되면 connected=true 이고
 * 화면은 폴링을 끈다. 키가 없으면 구독하지 않는다 (폴링 유지).
 */
export function useRaceRealtime({ myId, friendIds, onRace, onSignal }: Options): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const onRaceRef = useRef(onRace);
  const onSignalRef = useRef(onSignal);
  onRaceRef.current = onRace;
  onSignalRef.current = onSignal;
  const friendKey = [...friendIds].sort().join(",");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    const supabase = getSupabaseRealtime();
    const ids = friendKey ? friendKey.split(",") : [];

    const mine = supabase
      .channel(userChannel(myId))
      .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => onSignalRef.current(payload as SignalPayload))
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    const friends = ids.map((id) =>
      supabase
        .channel(userChannel(id))
        .on("broadcast", { event: RACE_EVENT }, ({ payload }) => onRaceRef.current(payload as RacePayload))
        .subscribe(),
    );

    return () => {
      setConnected(false);
      void supabase.removeChannel(mine);
      friends.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [myId, friendKey]);

  return { connected };
}
```

- [ ] **Step 5: RaceScreen 에 연결**

`app/web/src/features/race/components/race-screen.tsx` — import 추가:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useRaceRealtime } from "@/features/realtime/hooks/use-race-realtime";
import { RACE_TODAY_KEY } from "../hooks/use-race-today";
import { withRacerCount } from "../race-state";
```

컴포넌트 앞부분을 다음으로 바꾼다 (기존 `useRaceToday`/`useSignalToasts` 두 줄 대체):

```tsx
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const { data } = useRaceToday(initial, { polling: !connected });
  const { toasts, push } = useSignalToasts({ polling: !connected });

  const realtime = useRaceRealtime({
    myId: initial.me.userId,
    friendIds: data.racers.filter((r) => !r.isMe).map((r) => r.userId),
    onRace: (p) => {
      queryClient.setQueryData<RaceToday>(RACE_TODAY_KEY, (cur) =>
        cur && cur.date === p.date && p.userId !== cur.me.userId ? withRacerCount(cur, p.userId, p.tapCount) : cur,
      );
    },
    onSignal: push,
  });
  useEffect(() => setConnected(realtime.connected), [realtime.connected]);
```

(`useState` 를 react import 에 추가.) 레이스 헤더의 표시 문구를 바꾼다:

```tsx
<span className="inline-flex items-center gap-1.5 font-note text-[17px] text-pencil">
  <i className="h-2 w-2 animate-pulse rounded-full bg-marker" />
  {connected ? "실시간" : "2초마다 갱신"}
</span>
```

- [ ] **Step 6: ADR 갱신**

`docs/decisions/0002-realtime.md` 의 "브라우저:" 항목을 다음으로 교체:

```markdown
- 브라우저: `src/lib/supabase/client.ts` 의 publishable 클라이언트로 내 채널 `u:{myId}` (signal 이벤트) 와 친구 채널 `u:{friendId}` (race 이벤트) 를 구독한다. 채널·이벤트 이름은 `src/features/realtime/channels.ts`.
- 서버: 탭 저장·신호 발송 route handler 가 `next/server` 의 `after()` 안에서 `src/features/realtime/server/broadcast.ts` (secret 키, REST `httpSend`) 로 보낸다. 실패해도 응답은 성공이고 폴링이 받쳐준다.
```

- [ ] **Step 7: 수동 확인 (성공 기준 2·3, 1초 이내)**

1. `.env` 에 Supabase 키가 있는 상태로 `pnpm dev`. `/` 헤더가 "실시간" 으로 바뀐다. 네트워크 탭에 `/api/race/today` 2초 폴링이 없다.
2. B 가 탭 → A 화면의 B 졸라맨이 1초 안에 움직인다 (300ms 배치 + 브로드캐스트).
3. B 10연타 → A 에 토스트가 즉시(5초 폴링 없이) 뜬다.
4. `.env` 의 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 를 비우고 재시작 → "2초마다 갱신" 으로 폴백, 기능 동일.

- [ ] **Step 8: 검증·커밋**

Run: `pnpm typecheck && pnpm lint && pnpm test`

```bash
git add app/web/src docs/decisions/0002-realtime.md
git commit -m "Broadcast race and signal events over Supabase Realtime"
```

---

### Task 11: 마무리 (문서, 배포 확인, 전체 시나리오)

**Files:**
- Modify: `docs/tech-stack.md`, `docs/deploy.md`, `docs/user-journey.md`, `docs/README.md`, `AGENTS.md`, `app/web/AGENTS.md`, `app/web/.env.example`

- [ ] **Step 1: 문서 갱신**

- `docs/tech-stack.md` 인증 행: `better-auth 1.7 (+ username 플러그인)`, 이유 "아이디+비밀번호 개방형 로그인". 환경 변수 표에 `| TEST_DATABASE_URL | vitest 통합 테스트용 로컬 Postgres (기본 docker compose 값) |` 추가. `.env.example` 에도 주석으로 추가.
- `docs/deploy.md` "배포 후 확인" 2번을 "회원가입(아이디) → `user` 에 `username` 행" 으로, 4번 추가: "친구 등록 → 두 브라우저 탭 → 토스트 → 오늘 정산 → 도감".
- `docs/user-journey.md` 화면 목록을 Task 4 에서 정한 6개 경로로 교체.
- `AGENTS.md` 명령 블록에 `pnpm test              # vitest (통합 테스트는 pnpm db:up 필요)` 추가, 완료 기준에 `pnpm test` 추가.
- `app/web/AGENTS.md` 구조에 `src/features/friends | realtime` 과 `test/` 를 추가하고, 규칙에 "서비스 함수(`features/*/server/`)는 route handler 와 서버 컴포넌트가 함께 쓴다. 통합 테스트는 서비스 함수를 직접 부른다." 를 추가.
- `docs/README.md` 표에 `superpowers/specs`, `superpowers/plans` 행 추가.

- [ ] **Step 2: 전체 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: 모두 통과. `pnpm build` 에서 `/dev/ui` 는 프로덕션 404, 나머지 라우트가 목록에 나온다.

- [ ] **Step 3: 데모 시나리오 (성공 기준 1~5 한 번에)**

두 브라우저(일반·시크릿)에서 순서대로:

1. A 가입(30초 안에 첫 탭까지) → 졸라맨 이동 확인. [기준 1]
2. B 가입 → B 의 `/friends` 에서 A 아이디 등록 → 양쪽 `/` 에 서로 보임, 탭이 1초 안에 반영. [기준 2]
3. B 10연타 → A 토스트. [기준 3]
4. A 100번 이상 탭 → `/today` 정산 → 칭호·NEW → `/collection`. [기준 4]
5. 모든 화면이 줄노트·매직·연필 톤, 형광펜은 화면당 하나. [기준 5]

- [ ] **Step 4: 배포**

Vercel 은 `main` push 로 자동 배포. Supabase 에는 Task 2 에서 `migrate dev` 로 이미 스키마가 적용돼 있다. 배포 후 `https://tap-to-home-web.vercel.app/api/auth/ok` 200 확인, 위 시나리오를 프로덕션 URL 로 반복.

- [ ] **Step 5: 커밋**

```bash
git add -A docs AGENTS.md app/web/AGENTS.md app/web/.env.example
git commit -m "Document prototype workflow, test command, and demo checklist"
```
