# Data Model (PostgreSQL) — 초안

auth 테이블(`user`, `session`, `account`, `verification`)은 better-auth 계약이며 `app/web/prisma/schema.prisma` 에 있다. 아래는 도메인 테이블 초안. 확정되는 대로 같은 파일에 모델로 옮긴다.

## friendship — 친구 관계

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| requester_id | text fk user | |
| addressee_id | text fk user | |
| status | enum pending/accepted/blocked | |
| created_at | timestamptz | |

unique(requester_id, addressee_id). 양방향 조회는 두 컬럼 OR.

## daily_run — 하루 단위 레이스 상태

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| user_id | text fk user | |
| run_date | date | KST 기준 |
| tap_count | int | 오늘 누적. 화면과 랭킹은 이 값만 읽는다 |
| stage | smallint | 0~5, tap_count 로부터 계산해 저장 (조회 편의) |
| first_tap_at | timestamptz | 칭호 판정 |
| last_tap_at | timestamptz | |

unique(user_id, run_date). 랭킹 쿼리: 친구 user_id IN (...) AND run_date = today ORDER BY tap_count DESC.

## tap_event — 탭 로그 (칭호 분석용)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | bigserial pk | |
| daily_run_id | uuid fk daily_run | |
| tapped_at | timestamptz | |
| batch_size | smallint | 클라이언트가 묶어서 보낸 탭 수. 1탭 1행이 부담되면 배치로 |

칭호 판정은 시간대별 집계만 필요하므로 시간별 버킷 테이블로 대체 가능 (결정 보류).

## signal — 퇴근 신호

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | uuid pk | |
| sender_id | text fk user | |
| receiver_id | text fk user | |
| level | enum normal/strong/urgent/rescue | 1/5/10/30 연타 |
| sent_at | timestamptz | |
| read_at | timestamptz null | |

## title — 칭호 정의 (마스터)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text pk | 예: `early_leaver` |
| name | text | 출근하자마자 집 가고 싶었던 자 |
| description | text | |
| hint | text | 도감 미획득 시 힌트 |
| rule | jsonb | 판정 파라미터. 판정 로직은 코드에서 id 로 분기 |
| priority | int | 대표 칭호 선택 순 |

## user_title — 획득 기록

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| user_id | text fk user | |
| title_id | text fk title | |
| first_earned_on | date | |
| earned_count | int | 반복 획득 횟수 |

pk(user_id, title_id). 도감 카운트 = count(*) / count(title).

## daily_result — 정산 스냅샷

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| daily_run_id | uuid pk fk | |
| primary_title_id | text fk title | |
| title_ids | text[] | 그날 부여된 전체 |
| rank | int | 친구 중 순위 |
| settled_at | timestamptz | |
