# Prototype Design — 전체 기능 흐름 (F1·F2·F3 + 친구 등록 + 인증)

날짜: 2026-09-19 · 상태: 검토 대기

`docs/goal.md` 의 성공 기준 1~5 를 Vercel URL 하나로 시연할 수 있는 프로토타입. 기존 디자인 시스템(`docs/design.md`, `src/components/`)과 도메인 컴포넌트(`src/features/race/`)를 그대로 쓰고, DB(Prisma) 와 API(route handler / server action) 까지 실제로 연결한다.

## 1. 결정 사항 (이 스펙에서 새로 정한 것)

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 로그인 식별자 | **아이디(username) + 비밀번호**. 이메일 입력 없음 | 사용자 요청. better-auth `username` 플러그인 사용 |
| better-auth `email` 컬럼 | 유지하되 가입 시 `${username}@id.tap-to-home.local` 로 자동 생성. UI 에 노출하지 않음 | better-auth 코어 스키마가 `email` 을 필수로 요구하고, username 플러그인도 `/sign-up/email` 을 그대로 쓴다 |
| 닉네임 | `user.name` 에 저장. 화면(레이스·랭킹·신호 문구)에는 항상 닉네임 표시 | 아이디는 검색 키, 닉네임은 표시명 |
| 친구 연결 | `/friends` 에서 **아이디 정확 일치 검색 → "친구 등록"**. 등록 즉시 `accepted` (수락 절차 없음) | 사용자 요청 + 데모 30초 온보딩. `status` enum 은 유지해 나중에 pending 흐름을 넣을 수 있게 둔다 |
| 칭호 마스터 | DB 테이블이 아니라 코드 상수(`features/titles/catalog.ts`). `user_title.title_id` 는 FK 없는 text | 판정 로직이 어차피 코드에 있고, 50개까지 늘려도 배포로 끝난다. ADR 0005 |
| 하루 기준 | KST 고정. `run_date` = `(now + 9h).toISOString().slice(0,10)` | goal.md 미확정 항목을 대회용으로 확정 |
| 정산 | "오늘 정산" 버튼(수동)만. 자정 배치는 범위 밖 | 데모는 강제 정산으로 충분. 정산 후 오늘 탭 버튼 비활성 |
| 실시간 | 1차 폴링(2s) → 2차 Supabase Realtime broadcast. 채널은 **사용자당 하나** `u:{userId}`, 이벤트 `race` / `signal` | ADR 0002 A 안. 채널 이름은 ADR 이 "구현 시 확정" 으로 열어둔 부분 |
| 신호 전달 | 인앱 토스트만. 웹 푸시 범위 밖 | features.md 의 1차 채널 |
| 네비게이션 | 하단 탭 4개: 레이스(`/`) · 친구(`/friends`) · 오늘(`/today`) · 도감(`/collection`) | 회사에서 몰래 켜서 몇 초 안에 끝내는 동선 |

## 2. 화면과 흐름

| 경로 | 인증 | 데이터 읽기 경로 | 내용 |
| --- | --- | --- | --- |
| `/login` | 비로그인 | – | 아이디·비밀번호. 실패 시 "아이디 또는 비밀번호가 틀렸어요" |
| `/signup` | 비로그인 | – | 아이디(영문·숫자·`_`, 3~20자)·닉네임(1~12자)·비밀번호(8자 이상). 가입 즉시 로그인 → `/` |
| `/` | 필요 | TanStack Query `GET /api/race/today` (폴링 2s → Realtime) | 상단: 오늘 횟수(큰 숫자) + `StageStrip` + `TapButton`. 하단: `StageTicks` + 친구 `RaceLane` 목록(랭킹순, 나 포함). 신호 토스트 오버레이 |
| `/friends` | 필요 | TanStack Query `GET /api/friends` + 검색 `GET /api/users/search?username=` | 아이디 검색 입력 → 결과 카드(닉네임·아이디) → "친구 등록" 버튼. 아래 친구 목록(닉네임·아이디·오늘 횟수) |
| `/today` | 필요 | 서버 컴포넌트 (Prisma 직접) | 정산 전: 오늘 요약(총 횟수·첫 탭·랭킹) + "오늘 정산" 버튼(server action). 정산 후: 대표 칭호 카드 + 부여된 칭호 뱃지(NEW) + "도감 보기" |
| `/collection` | 필요 | 서버 컴포넌트 | `획득/전체` 카운트, `TitleBadge` 그리드(미획득은 locked+hint). 오늘 획득분 NEW |

`/` 의 메인과 친구 레이스는 한 화면에 세로로 둔다(`/dev/ui` 의 ①·② 를 합침). 모바일 폭에서 스크롤 한 번.

인증 게이트: `src/proxy.ts` 가 세션 쿠키(`better-auth.session_token`) 유무만 보고 `/login` 으로 리다이렉트(낙관적 검사). 실제 검증은 각 페이지·API 의 `auth.api.getSession`.

## 3. 데이터 모델 (Prisma)

`docs/data-model.md` 를 이 표 기준으로 갱신한 뒤 `schema.prisma` 에 반영, `pnpm db:migrate` 로 마이그레이션 1개(`domain_init`) 생성.

| 모델 | 변경 |
| --- | --- |
| `User` | `username String? @unique`, `displayUsername String?` 추가 (플러그인 계약) |
| `Friendship` | data-model 그대로. `status` 기본값 `accepted`. `@@unique([requesterId, addresseeId])` + `@@index([addresseeId])` |
| `DailyRun` | data-model 그대로. `runDate DateTime @db.Date`. `@@unique([userId, runDate])` |
| `TapEvent` | data-model 그대로 (`dailyRunId`, `tappedAt`, `batchSize`). `@@index([dailyRunId])` |
| `Signal` | data-model 그대로. `level` enum `SignalLevel { normal strong urgent rescue }`. `@@index([receiverId, sentAt])` |
| `UserTitle` | `titleId String` (FK 없음). `@@id([userId, titleId])` |
| `DailyResult` | `titleIds String[]`, `primaryTitleId String` (FK 없음). pk = `dailyRunId` |
| `Title` 테이블 | **만들지 않음** (결정 사항 참조) |

## 4. API 계약

모두 `src/app/api/**/route.ts`. 인증은 공통 헬퍼 `requireUser()` (`src/lib/auth/require-user.ts`) 가 세션 없으면 401.

| 메서드·경로 | 요청 | 응답 | 동작 |
| --- | --- | --- | --- |
| `GET /api/race/today` | – | `{ date, me: Racer, racers: Racer[], settled: boolean }` · `Racer = { userId, name, username, tapCount, stage, isMe }` 랭킹순 | 오늘 `daily_run` 을 나+친구 것 조회(없으면 0). `settled` 는 내 `daily_result` 존재 여부 |
| `POST /api/taps` | `{ count: 1..50 }` | `{ tapCount, stage }` | `daily_run` upsert + `tap_count` 증가(원자적), `first_tap_at` 은 null 일 때만, `last_tap_at` 갱신, `tap_event` 1행. 정산됐으면 409. Realtime 단계에서 `u:{me}` 에 `race` 브로드캐스트 |
| `POST /api/signals` | `{ level }` | `{ delivered: number }` | 친구 전원에게 `signal` 행 생성. 같은 (sender, receiver, level) 10분 내 중복은 건너뜀. Realtime 단계에서 각 `u:{friend}` 에 `signal` 브로드캐스트 |
| `GET /api/signals/unread` | – | `{ signals: [{ id, senderName, level, sentAt }] }` | 최근 10분 내 미읽음. 폴링 단계의 토스트 소스. 반환한 것은 `read_at` 세팅 |
| `GET /api/users/search?username=` | – | `{ user: { id, username, name } \| null }` | 정규화(소문자) 후 정확 일치. 본인이면 null |
| `GET /api/friends` | – | `{ friends: [{ userId, username, name, tapCount }] }` | 양방향 조회 |
| `POST /api/friends` | `{ username }` | `{ friend }` | 없으면 404, 이미 친구면 409, 본인이면 400. `status: accepted` 로 생성 |
| server action `settleToday()` | – | redirect `/today` | 아래 5절 |

## 5. 도메인 로직 (순수 함수, 단위 테스트 대상)

| 모듈 | 책임 |
| --- | --- |
| `src/lib/kst.ts` | `todayKst(now)`, `kstHour(date)`, `kstTimeLabel(date)` |
| `src/features/race/stages.ts` (기존) | `stageOf`, `progressOf` |
| `src/features/race/tap-batcher.ts` | 클라이언트 탭 누적 → 300ms 디바운스로 `count` flush. 실패 시 다음 flush 에 합산 |
| `src/features/signal/combo.ts` | 탭 시각 배열 → 연타 묶음(1.5s 창) → 도달한 최고 등급 `null \| normal \| strong \| urgent \| rescue`. 묶음 종료 시 한 번만 발화 |
| `src/features/signal/messages.ts` | 등급·닉네임 → 토스트 문구 ("민지가 긴급 퇴근 신호를 보냈어요") |
| `src/features/titles/catalog.ts` | 칭호 5종 정의 `{ id, name, hint, pose, priority }` |
| `src/features/titles/evaluate.ts` | `evaluate({ tapEvents, firstTapAt, total }) → titleIds[]`, `pickPrimary(titleIds)` |
| `src/features/titles/settle.ts` | 서버 전용. 오늘 run 로드 → evaluate → `user_title` upsert(`earned_count+1`, `first_earned_on`) → `daily_result` 생성(랭킹 포함). 이미 정산됐으면 no-op |

칭호 5종은 features.md 표 그대로. 우선순위(대표 선택): 마음만 이미 집에 있음 > 퇴근 1시간 전 폭주형 > 점심 먹고 모든 의욕을 잃은 자 > 출근하자마자 집 가고 싶었던 자 > 오늘은 버틸 만했던 자. 아무것도 안 맞으면 "오늘은 버틸 만했던 자" 를 부여하지 않고 대표 칭호 없음으로 표시("칭호 없음 · 내일 다시").

## 6. 클라이언트 상태 흐름 (`/`)

1. 서버 컴포넌트가 세션과 초기 `GET /api/race/today` 결과를 prefetch 해 HydrationBoundary 로 넘긴다.
2. `useRaceToday()` (TanStack Query) 가 `refetchInterval: 2000`. Realtime 단계에서는 interval 을 끄고 `race` 이벤트로 `setQueryData`.
3. `useTap()`:
   - `pointerdown` 즉시 `setQueryData` 로 내 `tapCount+1`, 프레임 토글(스톱모션).
   - `tap-batcher` 가 300ms 후 `POST /api/taps`. 응답의 `tapCount` 로 서버 값과 재동기화.
   - `combo` 가 묶음 종료를 감지하면 `POST /api/signals`.
4. `useSignalToasts()`: 폴링 단계 `GET /api/signals/unread` 5s → Realtime 단계 `signal` 이벤트. 최신 1개를 `SignalToast` 로 4초 표시.
5. Realtime 구독: 내 채널 `u:{me}` (signal) + 친구 채널 `u:{friendId}` (race). 친구 목록이 바뀌면 재구독.

## 7. 에러 처리

- API 는 `{ error: string }` + 상태 코드. 클라이언트는 mutation `onError` 에서 `Note` 스타일 한 줄 안내.
- `POST /api/taps` 409(정산됨) 를 받으면 `settled: true` 로 캐시를 갱신하고 버튼 비활성.
- Realtime 연결 실패 시 폴링을 유지(interval 을 끄지 않음). 연결 성공 이벤트에서만 끈다.
- 회원가입 아이디 중복은 `USERNAME_IS_ALREADY_TAKEN` → "이미 쓰는 아이디예요".

## 8. 테스트

- 단위(vitest 추가): `kst`, `combo`, `tap-batcher`, `titles/evaluate`, `stages`(기존 함수 회귀).
- 통합: route handler 는 로컬 Postgres(`pnpm db:up`) 대상으로 `taps`(증가·정산 409), `friends`(중복 409), `settle`(칭호 부여·NEW) 를 vitest 로 검증. 헬퍼 `test/db.ts` 가 테스트 사용자 생성·정리.
- 수동 시나리오(성공 기준): 두 브라우저(일반+시크릿)로 A·B 가입 → A 가 B 아이디 검색·등록 → 양쪽 `/` 에서 서로 보임 → B 10연타 → A 토스트 → A "오늘 정산" → `/collection` 카운트 상승.

## 9. 문서·ADR

- `docs/features.md`: F0 "계정·친구 등록" 절 추가(아이디 로그인, 아이디 검색 등록).
- `docs/data-model.md`: 3절 표대로 갱신, `title` 테이블 절 삭제, `user.username` 추가.
- `docs/decisions/0005-username-login-and-title-catalog-in-code.md`.
- `docs/goal.md` 열린 질문 3개를 확정 값으로 갱신(친구 추가: 아이디 검색 / 하루 기준: KST / 실시간: ADR 0002).
- `docs/design.md` 컴포넌트 표에 `BottomNav`, `TextField` 추가. `/dev/ui` 에 상태별 예시.

## 10. 범위 밖 (이번 프로토타입에서 하지 않음)

웹 푸시, 자정 자동 정산 배치, 친구 요청 수락/차단 UI, 칭호 50개 확장, 공유 기능, 프로필 이미지, 비밀번호 재설정, Flutter 변경(웹뷰 그대로).
