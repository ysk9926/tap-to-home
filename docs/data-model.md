# Data Model (PostgreSQL)

auth 테이블(`user`, `session`, `account`, `verification`)은 better-auth 계약이며 `app/web/prisma/schema.prisma` 에 있다. 도메인 모델도 같은 파일의 `// ── <domain>` 구역에 있다. 컬럼 이름은 Prisma 기본(camelCase)을 따르고, 테이블 이름만 `@@map` 으로 snake_case 다. 칭호 마스터는 테이블이 아니라 코드(`src/features/titles/catalog.ts`)에 있다 (`decisions/0005`).

## user (better-auth + username 플러그인)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| username | text unique null | 로그인·검색 키. 소문자 정규화 |
| displayUsername | text null | 플러그인 계약. 입력 원문 |
| email | text unique | `${username}@id.tap-to-home.local` 자동 생성. UI 비노출 |
| name | text | 닉네임(표시명) |
| deletedAt | timestamptz null | 소프트 삭제. 채워지면 로그인·검색·랭킹·친구 목록에서 제외한다. row 와 friendship 은 남긴다 |
| notifySignal | boolean not null default true | 퇴근 신호 푸시 수신 여부 (F2) |
| notifySettlement | boolean not null default true | 정산 결과 푸시 수신 여부 (F3) |
| suspendedAt | timestamptz null | 관리자 이용 정지. 탈퇴와 별도이며 일반 인증·친구·레이스·신호·푸시·정산에서 제외 |
| suspensionReason | text null | 관리자 정지 사유 |
| analyticsExcluded | boolean not null default false | 운영·테스트용 일반 계정을 제품 통계에서 제외 |

`deletedAt` 은 조회 시점에 거른다. 필터를 빠뜨려 탈퇴 유저가 유령으로 남는 것을 막기 위해
조건을 `src/lib/db/active-user.ts` 의 `ACTIVE_USER` 상수 하나로 모으고, 이를 쓰는 네 지점
(친구 검색·친구 목록·레이스 랭킹·세션 검증)에 각각 회귀 테스트를 둔다. 아이디는 탈퇴 후에도
unique 제약이 살아 있어 재사용할 수 없다.

## friendship — 친구 관계

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| requesterId | text fk user | 요청을 보낸 쪽 |
| addresseeId | text fk user | 요청을 받은 쪽. 수락·거절 권한은 이쪽에만 |
| status | enum pending/accepted/blocked | 기본 `pending`. 수락하면 `accepted` |
| blockedById | text fk user null | `blocked` 일 때만 채운다. 해제 권한 판별용 |
| respondedAt | timestamptz null | 수락·차단 시각 |
| createdAt | timestamptz | |

unique(requesterId, addresseeId). 양방향 조회는 두 컬럼 OR — 친구 목록은 `status = accepted`,
받은 요청은 `addresseeId = me AND status = pending`, 보낸 요청은 `requesterId = me AND status = pending`.
`blocked` row 는 방향과 무관하게 검색·요청을 막는다.

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
| seenAt | timestamptz null | 사용자가 이 결과를 본 시각. 앱 진입 다이얼로그를 한 번만 띄우는 기준 |

존재하면 그날은 정산된 것이고 `POST /api/taps` 는 409 를 돌려준다.

## push_token — 네이티브 푸시 토큰 (ADR 0006)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| userId | text fk user | 한 사용자가 기기 여러 대를 쓸 수 있어 여러 행 |
| token | text unique | FCM 등록 토큰. 같은 토큰이 다른 계정에서 올라오면 소유자를 바꾼다 |
| platform | enum ios/android | 통계·디버깅용 |
| createdAt | timestamptz | |
| updatedAt | timestamptz | 앱이 올릴 때마다 갱신. 오래된 행을 정리할 때 기준 |

발송이 `UNREGISTERED` 를 돌려주면 그 행을 지운다. 앱은 실행할 때마다 토큰을 올리고, 서버는 upsert 한다.

## 관리자 인증·운영 (F5, ADR 0010)

`admin_user`, `admin_session`, `admin_account`, `admin_verification`은 better-auth 코어와 username 플러그인의 필드 계약을 유지하는 별도 인증 모델이다. 일반 User와 관계가 없으며 마스터 신원의 내부 ID는 `master`로 고정한다. AdminUser에는 `disabledAt`을 추가한다. 세션 수명은 최대 8시간이며 비밀번호 교체·비활성화 시 전부 폐기한다. 일반 계정의 role 승격은 없다.

`admin_login_attempt`는 관리자 로그인 시도의 공유 제한이다. `key`(PK), `windowStartedAt`, `count`를 저장하며 서버에서 원자적으로 갱신한다. 원문 IP·비밀번호는 저장하지 않는다.

`admin_audit_log`는 `id`, `actorAdminId`(AdminUser FK), `targetUserId`(User FK), `action`, `reason`, `before`/`after`(허용 필드만 JSON), `createdAt`을 저장한다. 계정 상태·세션 변경과 같은 트랜잭션으로 기록하며 대상/시각 인덱스를 둔다. FK 삭제는 Restrict로 조치 이력을 보호한다.

## 접속·제품 분석 (F5)

`analytics_config`: `id`(PK, `product`), `startedAt`. 수집 첫 실행 때 생성하며 기존 활동을 방문으로 소급하지 않는다.

`user_daily_activity`: `userId`(User FK), `activityDate`(KST date)의 복합 PK, `firstSeenAt`, `lastSeenAt`. 날짜/사용자 인덱스를 둔다. 전경 방문과 승인된 탭에서 기록하고 lastSeen은 최대 5분에 한 번 갱신한다. 탈퇴·정지는 과거 활동을 지우지 않는다. User 물리 삭제 시 Cascade.

`product_event`: `id`(uuid PK), `dedupeKey`(unique nullable), `userId`(행위자 FK), `otherUserId`(상대 FK nullable), `type`(text), `entityId`(text), `occurredAt`. 타입/시각과 사용자/시각 인덱스. 친구 생성·수락·거절·취소·삭제·차단·해제를 도메인 변경과 같은 트랜잭션으로 기록한다. 결과 상세 열람은 `result_viewed`이고 dedupeKey로 사용자/결과당 최초 한 번만 저장한다. 행위자 물리 삭제 시 Cascade, 상대 물리 삭제 시 SetNull. 일반 `seenAt`과 별도다.
