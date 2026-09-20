# Query Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정상 연결 중 레이스·신호·친구의 반복 GET을 분당 약 45회에서 3회 수준으로 줄이고, 실시간 이동·장애 복구·푸시 전달을 유지한다.

**Architecture:** 인증된 앱 layout의 `LiveSyncProvider`에서 채널·친구 조회·신호 수신을 관리한다. 화면은 공유 연결 상태와 사용자별 Query 캐시를 사용하고, 정상 연결에서는 60초 보정, 장애 시 기존 폴링을 적용한다. Realtime 활성화 전에 신호의 실제 수신 확인을 브로드캐스트 발송 성공과 분리한다.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript, TanStack Query v5, Supabase JS 2.116.0, Prisma 7, Vitest. 클라이언트 생명주기 테스트에 React Testing Library와 jsdom을 개발 의존성으로 추가한다.

**Spec:** [조회 효율 개선 설계](../specs/2026-09-20-query-efficiency-design.md)

상태: Task 1~5 구현 완료, Task 6 로컬 검증 완료·실환경 검증 대기 (2026-09-20). 기준 커밋: `54af08c`. 작업 브랜치: `codex/query-efficiency`.

- 채널 컨트롤러·공통 Provider·사용자별 캐시·복귀/자정 보정·신호 수신 확인을 반영했다.
- 정책 통합 테스트는 `live-sync-provider.test.tsx`에 합쳤다. 독립 조회 타이머(`use-sync-polling.ts`)로 지속적인 캐시 갱신이 정기 조회를 연기하지 않게 했다.
- 리뷰에서 채널 생성/해제 실패, 복귀 직후 캐시 이벤트, 세션 종료 후 ACK를 재현하고 수정했다. 실제 HTTP 성공과 수동 캐시 갱신을 구별해 보정 조회를 판단한다.
- 실제 브라우저 기능 확인과 가상 시간 요청량 테스트를 구분해 [검증 결과](../../deploy.md#조회-효율-개선-검증-2026-09-20)에 기록했다.
- 실제 Realtime 키 설정·전후 production 성능 실측·기기 푸시·배포는 남아 있다. `SUPABASE_SECRET_KEY`가 없는 환경은 장애 폴링을 유지한다.
- 아래 Task 1~5 체크는 구현·테스트 완료를 뜻한다. 각 단계의 커밋 메시지는 제안이며 이번 작업에서 커밋·push·배포는 수행하지 않았다. 기존 사용자 변경은 유지했다.

## Global Constraints

- 웹은 `app/web/AGENTS.md`를 따른다. 구현 전에 설치된 Next.js의 Server/Client Components·Vitest 안내를 읽는다.
- DB 읽기·쓰기는 Prisma로만 수행한다. Supabase Auth·RLS·PostgREST 도입, 별도 WebSocket 서버, Flutter 변경, 테이블·마이그레이션 변경은 포함하지 않는다.
- 사용자 대면 문구는 한국어, 코드·식별자·커밋 메시지는 영어.
- 내 탭의 즉시 낙관적 업데이트, 300ms 배치 저장, 정산 409 처리와 KST 날짜 기준을 유지한다.
- 기능 문서와 다음 순번 ADR을 먼저 작성한다. 기존 기술의 채널 소유권·조회 정책 변경을 기록한다.
- 완료 기준: `pnpm typecheck`, `pnpm lint`, `pnpm test` 통과 및 설계 7절 시나리오 검증. DB 통합 테스트는 로컬 테스트 DB만 사용한다.
- 실시간 환경 변수 활성화와 배포는 Task 6에 둔다. 키 존재 여부만 기록한다. 환경 설정·배포는 이번 로컬 구현에 포함하지 않는다.
- 순서: Task 1 → 2 → 3 → 4 → 5 → 6. 각 태스크는 독립 커밋으로 검토할 수 있다. 사용자 요청이 계획 작성에 그치면 실행하지 않는다.

## 파일과 책임

아래 표의 코드는 모두 `app/web/` 아래이며 문서는 저장소 루트 기준이다.

| 생성·수정 | 파일 | 책임 |
| --- | --- | --- |
| 생성 | `src/features/realtime/session-controller.ts`, `.test.ts` | 채널 소유·차등 구독·전체 연결 판정·직렬 cleanup |
| 생성 | `src/features/realtime/sync-policy.ts`, `.test.ts` | 조회 주기·가시성 정책 |
| 생성 | `src/features/realtime/query-keys.ts` | 사용자별 도메인 Query 키 |
| 생성 | `src/features/realtime/components/live-sync-provider.tsx`, `.test.tsx` | 세션 생명주기·친구 상태·알림·캐시 갱신 |
| 생성 | `src/features/realtime/reconciler.ts`, `.test.ts` | 복귀·재연결 보정의 병합·정리 |
| 생성 | `src/features/realtime/hooks/use-sync-reconciliation.ts` | 문서 가시성·온라인·KST 날짜와 보정기 연결 |
| 생성 | `test/fake-supabase.ts` | 동일 topic 재사용과 중복 subscribe를 재현하는 SDK 경계 |
| 생성 | `src/features/realtime/supabase-transport.ts`, `.test.ts` | SDK 해제 결과 검증·세션 간 실패한 해제 재시도 |
| 생성 | `src/features/realtime/hooks/use-sync-polling.ts`, `browser-activity.ts`, `live-sync-context.ts`, `cache-updates.ts` | 독립 조회 주기·브라우저 상태·공유 컨텍스트·이벤트 캐시 반영 |
| 수정 | `src/app/(app)/layout.tsx`, `page.tsx`, `ranking/page.tsx`, `friends/page.tsx` | Provider 배치·중복 초기 조회 제거 |
| 수정 | `src/features/race/hooks/use-race-session.ts`, `use-race-today.ts`, `use-tap.ts` | 공유 상태·사용자별 키·조회 정책 사용 |
| 수정 | `src/features/race/components/race-screen.tsx`, `ranking-screen.tsx` | 페이지별 토스트 제거·공유 연결 표시 |
| 수정 | `src/features/friends/hooks/use-friends.ts`, `use-friend-actions.ts` | Provider의 단일 쿼리·사용자별 무효화 |
| 수정 | `src/features/friends/components/friends-screen.tsx`, `friend-request-watcher.tsx` | 공유 친구 데이터 소비 |
| 삭제 | `src/features/realtime/hooks/use-race-realtime.ts`, `src/features/friends/hooks/use-friend-realtime.ts` | Provider 전환 후 기존 독립 구독 제거 |
| 생성·수정 | `src/features/signal/signal-inbox.ts`, `.test.ts`, `hooks/use-signal-toasts.ts` | 10분 ID 중복 제거·수신 확인 배치 |
| 생성·수정 | `src/app/api/signals/read/route.ts`, `src/features/signal/server/signals.ts`, `.test.ts` | 인증된 수신자에 한정된 읽음 확인 |
| 생성 | `src/features/signal/server/deliver-signals.ts`, `.test.ts` | 브로드캐스트·푸시 전달의 서버 조합 |
| 수정 | `src/app/api/signals/route.ts`, `src/features/push/server/send-signal-push.ts` | 발송 성공과 실제 읽음 분리 |
| 수정 | `src/features/auth/components/logout-button.tsx` | 세션 조회 취소·캐시 정리 |
| 수정 | `package.json`, `vitest.config.mts`, 루트 `pnpm-lock.yaml` | 클라이언트 테스트 환경 |
| 생성·수정 | `docs/features.md`, `docs/deploy.md`, `docs/decisions/0007-shared-realtime-and-query-reconciliation.md` | 요구사항·운영 검증·ADR |
| 수정 | `docs/decisions/0006-native-push-fcm.md` | 읽음 판정·푸시 발송 정책 설명 정정 |

## Task 1: 채널 소유권과 생명주기 확립

**Files:** 위 표의 `session-controller` 쌍, `docs/features.md`, 새 ADR.

**Interfaces:** 기존 `RacePayload`, `SignalPayload`, `FriendPayload`는 `features/realtime/channels.ts`에서 가져온다. 외부에서 시작·정지 가능한 객체를 생성하되 생성자에서는 네트워크 연결을 만들지 않는다.

```ts
export type SyncSnapshot = { ownConnected: boolean; raceConnected: boolean };
export type ChannelStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
export type SyncChannel = {
  on(event: "race" | "signal" | "friend", callback: (payload: unknown) => void): SyncChannel;
  subscribe(callback: (status: ChannelStatus) => void): void;
};
export type SyncTransport = {
  channel(topic: string): SyncChannel;
  removeChannel(channel: SyncChannel): Promise<void>;
};
export type RealtimeSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
  setFriendIds(ids: readonly string[]): Promise<void>;
  getSnapshot(): SyncSnapshot;
  subscribe(listener: () => void): () => void;
};
export type SessionOptions = {
  userId: string;
  transport: SyncTransport;
  onRace: (payload: RacePayload) => void;
  onSignal: (payload: SignalPayload) => void;
  onFriend: (payload: FriendPayload) => void;
};
// session-controller.ts의 공개 팩토리 계약
export type CreateRealtimeSession = (options: SessionOptions) => RealtimeSession;
```

- [x] **1. 요구사항과 ADR을 먼저 추가한다.** 설계 3~7절을 F0-3·F1-2·F2에 연결한다. ADR에 같은 topic 재사용, 단일 소유자, 60초 보정, 사용자별 캐시, 실제 수신 확인을 기록한다. 번호 0007이 사용됐으면 다음 번호로 변경한다.
- [x] **2. 실패를 재현하는 테스트를 작성한다.** `createRealtimeSession(options)` export를 대상으로, 가짜 transport도 같은 topic에 같은 객체를 반환하도록 만든다. 다음 표의 모든 상태 변화를 검사한다.

| 입력 | 검증 |
| --- | --- |
| `start()` 두 번 | 내 topic 생성·subscribe 각 1회 |
| 내 채널 SUBSCRIBED, 친구 joining | `{ ownConnected: true, raceConnected: false }` |
| 내 채널과 모든 친구 SUBSCRIBED | 두 값 true |
| 친구 하나 CHANNEL_ERROR | own true, race false |
| 친구 ID 순서만 변경 | 생성·삭제·subscribe 추가 호출 0회 |
| 친구 한 명 추가·삭제 | 해당 채널만 변경, 내 채널 해제 0회 |
| `stop()` 직후 `start()`, 제거 Promise 지연 | 제거 완료 전 같은 topic 생성 0회 |
| 이전 세대 CLOSED 콜백 | 새 세대 연결 상태에 영향 없음 |
| `stop()` 반복 | 남은 채널·리스너 0개 |

- [x] **3. RED를 확인한다.** `pnpm --filter web test src/features/realtime/session-controller.test.ts`. 새 팩토리가 없어서 실패해야 한다. 가짜 SDK가 독립 채널을 반환해 실제 문제를 숨기지 않는지 확인한다.
- [x] **4. 구현한다.** 내 채널에서 세 리스너를 먼저 붙인 뒤 한 번 구독한다. `Map<userId, channel>`로 친구 집합 차이를 적용하고, Promise 큐로 시작·정지·차등 갱신을 직렬화한다. 세대 번호로 해제된 채널 콜백을 무시한다. 스냅샷 객체는 값이 바뀔 때만 새로 만든다.

내 채널 등록 순서:

```ts
const mine = transport.channel(userChannel(userId));
mine.on("friend", (payload) => onFriend(payload as FriendPayload));
mine.on("signal", (payload) => onSignal(payload as SignalPayload));
mine.on("race", (payload) => onRace(payload as RacePayload));
mine.subscribe(handleOwnStatus);
```

`handleOwnStatus(status: ChannelStatus)`는 해당 세대의 내 연결 상태를 갱신하고 전체 스냅샷을 재계산하는 내부 함수다. transport 어댑터는 Provider에서 SDK의 broadcast 리스너 등록 API와 연결한다.

- [x] **5. GREEN과 완료 기준을 확인한다.** 2단계 표 전체 통과. 앱은 아직 기존 구독을 사용하므로 이 단계만으로 성능 개선을 주장하지 않는다. 커밋: `fix: centralize realtime channel lifecycle`.

## Task 2: 조회 정책과 사용자별 키 정의

**Files:** `sync-policy.ts`, `.test.ts`, `query-keys.ts`.

**Interfaces:** 세 도메인 쿼리는 다음 함수를 공유한다. 서버의 비밀 키를 클라이언트 모듈에 import하지 않는다.

```ts
export const raceTodayKey = (userId: string) => ["race", "today", userId] as const;
export const friendsKey = (userId: string) => ["friends", userId] as const;
export const signalsUnreadKey = (userId: string) => ["signals", "unread", userId] as const;

export type SyncDomain = "race" | "friends" | "signals";
export type QueryPolicy = { enabled: boolean; staleTime: number; refetchInterval: number | false };
export type PolicyInput = {
  domain: SyncDomain;
  connected: boolean;
  visible: boolean;
  online: boolean;
  active: boolean;
};
```

- [x] **1. 동작을 수치로 검증하는 테스트를 작성한다.** 다음 테스트를 포함해 모든 domain과 숨김·오프라인·비활성 조합을 표 기반으로 검증한다.

```ts
import { expect, it } from "vitest";
import { getQueryPolicy } from "./sync-policy";

it("keeps race fallback fast until every required channel is ready", () => {
  const input = { domain: "race" as const, visible: true, online: true, active: true };
  expect(getQueryPolicy({ ...input, connected: false })).toEqual({
    enabled: true, staleTime: 30_000, refetchInterval: 2_000,
  });
  expect(getQueryPolicy({ ...input, connected: true })).toEqual({
    enabled: true, staleTime: 30_000, refetchInterval: 60_000,
  });
  expect(getQueryPolicy({ ...input, connected: true, visible: false })).toEqual({
    enabled: false, staleTime: 30_000, refetchInterval: false,
  });
});
```

- [x] **2. RED를 확인한다.** `pnpm --filter web test src/features/realtime/sync-policy.test.ts`.
- [x] **3. 다음 정책과 사용자 키를 구현한다.**

```ts
export function getQueryPolicy(input: PolicyInput): QueryPolicy {
  const enabled = input.active && input.visible && input.online;
  const fallback = { race: 2_000, friends: 20_000, signals: 5_000 };
  return {
    enabled,
    staleTime: input.domain === "race" ? 30_000 : 60_000,
    refetchInterval: enabled ? (input.connected ? 60_000 : fallback[input.domain]) : false,
  };
}
```

- [x] **4. GREEN 확인 및 커밋.** 정책 표와 사용자 A/B의 키가 다름을 확인한다. 커밋: `feat: define shared query synchronization policy`.

## Task 3: Provider와 화면 통합

**Files:** `live-sync-provider.tsx`, `.test.tsx`, 레이아웃·화면·기존 훅·로그아웃 컴포넌트, 테스트 설정. 정확한 파일 목록은 상단 표의 해당 행을 따른다.

**Interfaces:**

```ts
export type LiveSyncProviderProps = {
  userId: string;
  initialFriends: FriendsState;
  realtimeEnabled: boolean;
  children: React.ReactNode;
};
export type LiveSyncValue = {
  userId: string;
  friends: FriendsState;
  ownConnected: boolean;
  raceConnected: boolean;
  visible: boolean;
  online: boolean;
};
// live-sync-provider.tsx에서 export
export type UseLiveSync = () => LiveSyncValue;
```

`FriendsState`는 기존 `features/friends/server/friends-state.ts`에서 type-only import한다. 구현 export 이름은 `LiveSyncProvider`, `useLiveSync`다. `useRaceSession(initial: RaceToday)`는 `{ data, connected }`만 반환한다. `useFriendActions(userId: string)`와 `useTap({ userId, onTap })`는 명시적으로 사용자 ID를 받는다.

- [x] **1. 클라이언트 테스트 환경을 추가한다.**

```bash
pnpm --filter web add -D @testing-library/react @testing-library/dom jsdom @vitejs/plugin-react
```

`vitest.config.mts`는 기존 node 기본값·DB setup·직렬 파일 실행을 유지하고 다음 항목만 반영한다. Provider 테스트 파일 첫 줄에 `// @vitest-environment jsdom`을 넣는다.

```ts
import react from "@vitejs/plugin-react";
// 기존 defineConfig 객체에 추가·교체
plugins: [react()],
// 기존 test 객체의 include만 교체
include: ["src/**/*.test.{ts,tsx}"],
```

- [x] **2. Provider 통합 테스트를 먼저 작성한다.** 실제 QueryClient와 React Testing Library를 사용하고 Supabase transport·Next `usePathname`·fetch만 경계에서 대체한다. 동일 topic을 공유하는 SDK 동작과 지연 cleanup을 반영한다.

| 시나리오 | 필수 assertion |
| --- | --- |
| 초기 친구 데이터를 넘겨 마운트 | 즉시 `/api/friends` 추가 GET 0회 |
| 요청 다이얼로그와 친구 화면 동시 마운트 | 친구 QueryObserver 소유자 1개 |
| `/` → `/ranking` → `/friends` | 내 topic subscribe 1회, 공용 토스트 영역 1개 |
| `/friends` → `/collection` | 친구 채널 해제, 내 채널 유지 |
| 친구 race 이벤트 | 해당 친구 횟수·레이스 순위 갱신, GET 0회 |
| 친구 변경 mutation | 현재 사용자 키만 무효화 |
| StrictMode setup-cleanup-setup | 활성 내 채널 1개, 늦은 cleanup이 새 채널을 끊지 않음 |
| 사용자 A 종료 후 B 시작 | A 채널·쿼리 제거, B 화면에 A 데이터 없음 |

- [x] **3. RED 확인.** `pnpm --filter web test src/features/realtime/components/live-sync-provider.test.tsx`.
- [x] **4. Provider와 소비자를 연결한다.** 서버 layout은 기존 친구 초기 데이터를 내려주며 다음 형태로 감싼다.

```tsx
<LiveSyncProvider
  key={user.id}
  userId={user.id}
  initialFriends={friends}
  realtimeEnabled={realtimeEnabled()}
>
  {children}
  <FriendRequestWatcher />
</LiveSyncProvider>
```

실제 `Paper`·BottomNav·PushRegistrar 배치는 유지한다. Provider는 `useFriends`와 `useSignalToasts`를 한 번 호출하고 `SignalToastLayer`를 한 번 렌더링한다. `useFriends`는 userId·초기 데이터·정책을 받으며 페이지는 직접 호출하지 않는다. 친구 page는 기존 인증과 사용자 표시만 남기고 `getFriendsState` 중복 호출을 제거한다.

`useRaceToday`와 `useSignalToasts`는 사용자별 키, 정책 반환값, `refetchIntervalInBackground: false`를 사용한다. unread의 `gcTime: 0`은 제거한다. 두 race 화면에서 독립 토스트 렌더링과 `realtimeEnabled` prop을 제거한다. `useRaceSession`은 Context의 `raceConnected`로 레이스 정책을 계산한다. 기존 두 구독 훅의 모든 호출자를 이관한 뒤 파일을 삭제한다.

Provider는 `useSyncExternalStore(session.subscribe, session.getSnapshot, serverSnapshot)`로 상태를 읽는다. `serverSnapshot`은 모듈 상수 `{ ownConnected: false, raceConnected: false }`를 반환한다. 세션 객체는 부작용 없이 생성하고 effect에서 `start()`/`stop()`을 호출한다. 친구 변경과 경로 변경은 `setFriendIds`만 호출한다. callback은 최신 캐시와 사용자 키를 참조한다.

- [x] **5. 세션 정리를 연결한다.** 로그아웃 성공 후 해당 사용자의 세 쿼리를 `cancelQueries` → `removeQueries` 순으로 정리하고 기존 로그인 이동을 수행한다. Provider cleanup은 채널·타이머·리스너를 해제한다. 이전 사용자의 늦은 HTTP 응답이 새 사용자 키에 쓰이지 않는지 검증한다.
- [x] **6. GREEN·타입 검사·커밋.** `pnpm --filter web test src/features/realtime/components/live-sync-provider.test.tsx`와 `pnpm typecheck`. `rg -n 'RACE_TODAY_KEY|FRIENDS_KEY|SIGNALS_UNREAD_KEY|polling: true|useRaceRealtime|useFriendRealtime' app/web/src`로 이전 연결·키 참조가 남지 않았는지 확인한다. 커밋: `refactor: share realtime state across app screens`.

## Task 4: 재연결·복귀·자정·정산 보정

**Files:** `reconciler.ts`, `.test.ts`, `hooks/use-sync-reconciliation.ts`, `components/live-sync-policy.test.tsx`, Provider·레이스 조회 훅·기존 `race-state.test.ts`.

**Interfaces:**

```ts
export type ReconcileReason = "resume" | "online" | "realtime" | "midnight";
export type Reconciler = {
  request(reason: ReconcileReason): void;
  dispose(): void;
};
export type ReconcilerOptions = {
  canRun: () => boolean;
  run: () => Promise<void>;
};
// reconciler.ts: createReconciler(options: ReconcilerOptions): Reconciler
```

`request`는 100ms 안의 원인을 한 번으로 합치고, 실행 중에는 중복 실행하지 않으며 추가 요청을 다음 한 번으로 합친다. 숨김 상태의 요청은 보류했다가 복귀 요청 시 실행한다. `dispose`는 타이머와 보류 요청을 정리한다.

- [x] **1. 타이머와 실제 Query를 사용하는 실패 테스트를 작성한다.**

```ts
import { expect, it, vi } from "vitest";
import { createReconciler } from "./reconciler";

it("coalesces visibility, network and realtime recovery", async () => {
  vi.useFakeTimers();
  const run = vi.fn(async () => {});
  const reconciler = createReconciler({ canRun: () => true, run });
  try {
    reconciler.request("resume");
    reconciler.request("online");
    reconciler.request("realtime");
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
  } finally {
    reconciler.dispose();
    vi.useRealTimers();
  }
});
```

Provider 테스트에서 가짜 타이머로 300초를 진행해 정상 상태의 각 GET 5회 이하, 숨김·오프라인 0회, 친구 채널만 실패했을 때 레이스 2초 주기를 검증한다. 초기 마운트와 연결 안정화 요청은 계수 전에 초기화한다.

- [x] **2. RED를 확인한다.** `pnpm --filter web test src/features/realtime/reconciler.test.ts src/features/realtime/components/live-sync-provider.test.tsx`.
- [x] **3. 보정기를 연결한다.** `visibilitychange`, `online`, 세션의 false→true 전이, KST 자정 타이머가 `request`를 호출한다. 최초 SUBSCRIBED도 구독 전후 틈을 한 번 보정하며 초기 측정 구간에 포함한다. cleanup에서 리스너·자정 타이머·보정기를 모두 해제한다.

보정기의 `run`은 현재 사용자 친구·신호와 활성 레이스만 대상으로 한다. 요청 중인 쿼리를 강제로 취소하지 않는다.

```ts
await queryClient.refetchQueries(
  { queryKey: raceTodayKey(userId), exact: true, type: "active" },
  { cancelRefetch: false },
);
```

친구·신호도 같은 호출 형태를 사용한다. 해당 쿼리의 기본 포커스·온라인 재조회는 이 단계에서 끄고 보정기 단일 경로로 바꾼다. friend 이벤트·mutation은 캐시를 무효화하되 숨김 상태에서 즉시 refetch하지 않는다.

- [x] **4. 날짜·정산·낙관적 값 회귀를 막는다.** 새 서버 초기값의 날짜가 캐시보다 늦거나 같은 날짜의 `settled`가 false→true이면 초기값을 반영한다. 같은 날짜의 일반 초기값은 앞선 로컬 카운트를 덮지 않는다. 아래 판정은 `useRaceToday`의 effect 안에서 현재 캐시를 읽어 적용하고 렌더 중 setQueryData하지 않는다.

```ts
const mustApplyInitial = !current || initial.date > current.date ||
  (initial.date === current.date && initial.settled && !current.settled);
if (mustApplyInitial) queryClient.setQueryData(raceTodayKey(userId), initial);
```

테스트 입력은 KST `2026-09-20`의 로컬 120회/서버 100회, 같은 날짜 정산 완료, 다음 날 0회, 이전 날 지연 이벤트다. 기대값은 각각 120회 유지, settled=true, 다음 날 0회, 이전 날 이벤트 무시다. 정산 SSR 값이 true인 첫 렌더부터 탭 비활성화도 검사한다.

- [x] **5. GREEN·커밋.** 타이머 테스트·기존 `race-state.test.ts`·`tap-batcher.test.ts` 통과. 커밋: `fix: reconcile live queries on recovery and day changes`.

## Task 5: 실시간 신호의 실제 수신 확인

**Files:** `signals/read/route.ts`, signal 서비스·테스트·inbox·전달 조합·기존 signal route와 push 서비스. 이 단계가 완료되기 전에 실시간 키만 활성화하지 않는다.

**Interfaces:**

```ts
// signals.ts: 기존 무소유자 markSignalsRead를 아래 계약으로 교체
export type MarkSignalsRead = (receiverId: string, ids: string[], now?: Date) => Promise<void>;
// POST /api/signals/read: { ids: string[] }, 1~50개, 각 ID는 비어 있지 않은 문자열
// 성공: 204. 미인증: 401. 잘못된 body: 400. 타인 ID는 변경 없이 204.

export type SignalInbox = {
  accept(signal: SignalPayload, source: "realtime" | "poll"): boolean;
  dispose(): void;
};
export type SignalInboxOptions = {
  now: () => number;
  visible: () => boolean;
  onToast: (signal: SignalPayload) => void;
  acknowledge: (ids: string[]) => Promise<void>;
};
// signal-inbox.ts: createSignalInbox(options: SignalInboxOptions): SignalInbox
```

- [x] **1. 소유권·중복·발송 실패 테스트를 먼저 작성한다.** `signals.test.ts`의 기존 사용자 fixture `s`, `r1`, `r2`와 `NOW`를 재사용하되 테스트마다 다른 등급·시간을 사용해 cooldown에 의존하지 않는다. 다음 검증을 추가한다.

```ts
const at = new Date(NOW.getTime() + 5 * SIGNAL_COOLDOWN_MS);
const sent = await sendSignal(s.id, "normal", at);
await markSignalsRead(r1.id, sent.signals.map((signal) => signal.id), at);
await markSignalsRead(r1.id, sent.signals.map((signal) => signal.id), at);
const rows = await prisma.signal.findMany({
  where: { id: { in: sent.signals.map((signal) => signal.id) } },
});
expect(rows.find((row) => row.receiverId === r1.id)?.readAt).toEqual(at);
expect(rows.find((row) => row.receiverId === r2.id)?.readAt).toBeNull();
```

inbox 단위 테스트는 같은 ID를 실시간→4초 후 poll로 주어 토스트 1회, 숨김 수신 시 토스트·ACK 0회, ACK 실패 1초·2초 재시도와 4xx 중단을 검사한다. 전달 조합 테스트는 `broadcast=true`인 경우에도 모든 생성 ID가 푸시 검사로 전달되고 서버가 읽음 표시하지 않음을 검사한다. 푸시는 mock으로 대체해 외부 알림을 보내지 않는다.

- [x] **2. RED 확인.** `pnpm --filter web test src/features/signal/server/signals.test.ts src/features/signal/signal-inbox.test.ts src/features/signal/server/deliver-signals.test.ts`. DB 서비스 테스트는 로컬 Postgres를 준비한다.
- [x] **3. 읽음 서비스와 인증 route를 구현한다.** 기존 `jsonError`, `parseJson`, `getCurrentUser` 규칙을 사용한다. ID는 중복 제거 후 갱신한다.

```ts
export async function markSignalsRead(receiverId: string, ids: string[], now = new Date()): Promise<void> {
  if (ids.length === 0) return;
  await prisma.signal.updateMany({
    where: { receiverId, id: { in: [...new Set(ids)] }, readAt: null },
    data: { readAt: now },
  });
}
```

- [x] **4. 서버 전달 조합을 분리한다.** `deliver-signals.ts`는 `sendSignal`이 생성한 `{ id, receiverId }[]`, senderName, level, sentAt을 받아 각 수신자에게 브로드캐스트하고 모든 생성 ID를 `sendSignalPush`로 전달한다. `api/signals/route.ts`는 저장 후 기존 `after()`에서 이 함수를 호출한다. `broadcast` 성공 ID로 읽음 표시하거나 푸시 대상을 제외하는 코드를 제거한다. 발송 실패는 신호 DB 저장을 되돌리지 않는다.
- [x] **5. inbox와 Provider를 연결한다.** 실시간 소스는 보이는 화면의 최초 수신만 토스트에 반영하고 ACK 큐에 넣는다. poll 소스는 기존 GET에서 이미 읽음 처리하므로 추가 ACK를 보내지 않는다. 미읽음 GET이 실행될 당시 보였지만 응답 전에 숨겨진 경우에는 표시를 복귀까지 보류한다. TTL 10분의 ID 저장소와 ACK 타이머는 Provider 세션 동안 공유하고 종료 시 정리한다.

```ts
const response = await fetch("/api/signals/read", {
  method: "POST",
  credentials: "same-origin",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ids }),
});
if (!response.ok) throw new ApiError(response.status, "신호 수신 확인에 실패했어요");
```

현재 `fetchJson`은 항상 응답을 JSON으로 파싱하므로 204에는 맞지 않는다. ACK 함수는 위처럼 상태 코드만 검사하고 기존 `ApiError`로 실패를 구분한다. 범용 `fetchJson` 계약을 이번 작업에서 바꾸지 않는다.

- [x] **6. GREEN·문서·커밋.** 기존 미읽음 GET·쿨다운 테스트도 통과해야 한다. ADR 0006의 발송 성공=읽음 전제와 유예 설명을 실제 구현에 맞추고 새 ADR을 연결한다. 인앱/FCM 경합 중복 가능성을 명시한다. 커밋: `fix: acknowledge signal receipt before marking it read`.

## Task 6: 환경 확인·통합 검증·성능 측정

**Files:** `docs/deploy.md`, `docs/README.md`, 이 계획의 실행 결과 체크박스. 앱 환경 변수는 저장소 파일에 추가하지 않는다.

- [x] **1. 테스트 대상 DB를 확인한다.** 기존 실행 중인 로컬 Postgres와 스키마를 확인하고 `TEST_DATABASE_URL`을 localhost로 지정했다. 추가 DB 기동·마이그레이션은 필요하지 않았다. 기본 Supabase 연결로 migration 명령을 실행하지 않았다.
- [x] **2. 필수 검사와 빌드를 수행한다.** 최종 코드에서 네 명령 모두 통과했다. 테스트 23개 파일·153개 통과. 컨트롤러/SDK 어댑터 재검토와 Provider/신호 통합 재검토에서도 남은 차단 문제가 없었다.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

실패 시 해당 원인·실행 환경을 기록하고 해결한 범위만 재검사한다. Flutter·Prisma 스키마 변경이 없음을 diff로 확인한다.

- [ ] **3. 환경 변수와 실시간 상태를 실제 대상 환경에서 확인한다.** URL·publishable·secret 세 키 존재, 공개 키의 빌드 반영 여부, WebSocket SUBSCRIBED, 서버 broadcast 결과를 확인한다. 키 값을 로그·HAR·문서에 남기지 않는다. 설정 누락이면 현재 폴링 동작을 유지하며 해당 환경에서 요청 감소를 달성했다고 기록하지 않는다.
- [ ] **4. 동일 조건으로 전후 5분을 측정한다.** 기준 커밋과 변경 버전을 같은 production 빌드 모드에서 실행한다. 우선 같은 정상 Realtime 설정으로 코드 개선을 비교하고, 기존 폴링 환경과 최종 정상 환경 비교는 별도 표로 남긴다. 초기 연결 안정화 후 카운터를 초기화하고 아래 항목을 각각 집계한다.

| 측정 조건 | 기록할 값 | 목표 |
| --- | --- | --- |
| `/`, 친구 있음, 전경 idle 300초 | 각 GET 횟수·합계·전송량·응답 시간 | 합계 ≤15 |
| `/ranking`, 동일 조건 | 동일 | 합계 ≤15 |
| `/friends`, `/today`, `/collection` 각각 | race GET·friends GET·unread GET | race 0, 나머지 합계 ≤10 |
| 문서 숨김 60초 | 신규 GET | 0 |
| 실제 signal 이벤트 있음 | GET와 ACK POST를 별도 기록 | 같은 ID 토스트 1회 |

DB 쿼리 수·서버 함수 호출 수는 로그에서 확보한 경우에만 추가한다. 비율은 같은 조건의 실측끼리 계산한다. 인증 쿠키·토큰이 든 원본 HAR를 저장소에 커밋하지 않는다.

- [ ] **5. 장애·기능 회귀를 시연한다.** 서로 친구인 두 테스트 계정으로 탭 전파, friend 요청·수락·삭제·차단, 전체 WS 차단, 친구 채널만 실패, 재연결, 화면 전환, 자정, 정산 복귀, 로그아웃 후 다른 계정 로그인을 확인한다. 테스트 목적의 신호만 보낸다. FCM/APNs가 준비된 테스트 기기에서는 앱 종료 상태에서 브로드캐스트가 성공해도 푸시가 도착하는지 확인한다. 기기 검증을 못 했으면 서버 mock 검증과 구분해 미검증으로 기록한다.
- [ ] **6. 점진 적용과 복구 절차를 기록한다.** 절차는 `deploy.md`에 기록 완료했고 Preview/운영 적용은 미실행이다. Preview에서 앞 단계들을 확인한 뒤 기존 배포 절차로 적용한다. 구독 재연결 반복·백그라운드 푸시 누락·카운트 역행이 발생하면 마지막 정상 배포로 되돌린다. 서버 `SUPABASE_SECRET_KEY`가 없는 환경은 기존 폴링으로 동작한다. Vercel 환경 변수 변경은 새 배포에 반영한다.
- [x] **7. 완료 증거와 문서 반영.** `deploy.md`에 가상 시간 테스트 수치·브라우저 기능 검증·실환경 미검증 항목을 구분해 기록하고 `docs/README.md`에서 설계·계획으로 연결했다. 커밋은 미실행이며 제안 메시지는 `docs: record realtime query verification results`다.

## 계획 자체의 검토 기준

- [x] 현행 코드·로컬 SDK 재현·미확인 배포 환경을 구분했다.
- [x] 내 채널과 모든 필요한 친구 채널의 연결 상태를 구분했다.
- [x] 홈 순위·친구 화면 횟수 때문에 해당 화면도 친구 채널이 필요함을 반영했다.
- [x] 캐시 신선도와 정기 조회 주기를 분리하고 정상·장애·숨김 정책을 정했다.
- [x] 자정·정산·낙관적 탭·계정 전환을 회귀 검사에 포함했다.
- [x] Realtime 활성화가 기존 푸시 전달을 막지 않도록 실제 수신 확인을 포함했다.
- [x] 예상 요청 감소와 실제 성능 측정을 구분하고, 키 누락 상태의 효과를 과장하지 않았다.

구현 완료 판정은 위 계획 검토 체크가 아니라 Task 1~6의 실행·검증 결과로 한다.
