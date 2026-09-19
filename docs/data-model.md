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
