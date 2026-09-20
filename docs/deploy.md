# Deploy — Vercel + Supabase

## Supabase 프로젝트

1. 프로젝트 ref `afkdblzdwpjzfvttbewt`, 리전 `ap-northeast-2 (Seoul)`. Vercel 리전(`icn1`)과 맞춘다.
2. 연결 문자열 (호스트 `aws-0-ap-northeast-2.pooler.supabase.com`, 사용자 `postgres.afkdblzdwpjzfvttbewt`). `app/web/.env.example` 에 템플릿이 있다.
   - Transaction pooler (포트 6543) → `DATABASE_URL`. 앱 런타임용. 서버리스에서 커넥션 폭주를 막는다.
   - Session pooler (포트 5432) → `DIRECT_URL`. prisma migrate 용. Direct connection 은 IPv6 전용이라 대부분의 로컬 네트워크에서 안 붙는다.
3. Project Settings → API Keys 에서 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`(sb_publishable_…), `SUPABASE_SECRET_KEY`(sb_secret_…). 구형 anon/service_role JWT 키는 쓰지 않는다.
4. 마이그레이션: 개발 중 스키마 변경은 `pnpm db:migrate` (`prisma migrate dev`, 마이그레이션 생성+적용). 배포 환경에는 `pnpm db:deploy` (`prisma migrate deploy`) 만 실행한다. 2026-09-19 기준 초기 마이그레이션(`init`, better-auth 테이블)은 Supabase 에 적용된 상태.

Supabase Auth 와 RLS 는 사용하지 않는다. 인증은 better-auth, DB 접근은 Prisma(서버)만 한다. publishable 키는 Realtime 채널 구독에만 쓰이므로 테이블을 읽지 못하는 상태가 정상이다.

## Vercel 프로젝트

프로젝트 이름 `tap-to-home-web`, production 도메인 `https://tap-to-home-web.vercel.app`. 환경 변수는 `app/web` 에서 `npx vercel link --project tap-to-home-web` 후 `vercel env add <NAME> <production|preview>` 로 넣는다(비밀값은 `--sensitive`).

| 설정 | 값 |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `app/web` |
| Include source files outside of the Root Directory | 켬 (기본값). 루트 `pnpm-workspace.yaml` 과 lockfile 을 읽는다 |
| Install Command | 기본값. 루트 `packageManager` 필드(pnpm 11)를 따라 워크스페이스 설치 |
| Node.js | 24.x |

환경 변수 (Production / Preview 각각):

| 변수 | Production | Preview |
| --- | --- | --- |
| `DATABASE_URL` | Supabase transaction pooler | 동일 (또는 브랜치용 별도 프로젝트) |
| `DIRECT_URL` | 불필요 (빌드에서 마이그레이션 안 함. `build` 앞단의 `prisma generate` 는 DB 에 접속하지 않음) | 불필요 |
| `BETTER_AUTH_SECRET` | 새로 생성 | Production 과 다른 값 |
| `BETTER_AUTH_URL` | `https://<production-domain>` | 비움 → 코드가 `VERCEL_URL` 로 대체 |
| `NEXT_PUBLIC_APP_URL` | `https://<production-domain>` | 비움 가능 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 값 | 동일 |
| `SUPABASE_SECRET_KEY` | Supabase 값 | 동일 |
| `CRON_SECRET` | 자정 정산 크론(`/api/cron/settle`) 인증. Vercel 프로젝트 설정에 넣으면 Cron 요청에 자동으로 실린다. 값이 없으면 엔드포인트가 500 을 돌려주고 정산이 돌지 않는다 (ADR 0008) | 필요 시 별도 값 |

`vercel.json` 은 리전(`icn1`)을 고정하고 자정 정산 크론(`/api/cron/settle`, `5 15 * * *`)을 등록한다. 나머지는 대시보드 설정.

Prisma 클라이언트는 `src/generated/prisma` 에 생성되고 커밋하지 않는다. Vercel 은 빌드 캐시로 `node_modules` 를 복원하면 설치를 건너뛰어 `postinstall` 이 돌지 않으므로, 생성은 `build` 스크립트 앞단(`prisma generate && next build`)에서 한다. `postinstall` 은 로컬 설치 편의를 위해 남겨둔다.

## 배포 후 확인

1. `https://<domain>/api/auth/ok` 가 200 → better-auth 기동.
2. 회원가입(아이디) → `user` 에 `username` 행.
3. 두 브라우저에서 레이스 화면을 열고 탭 → 상대 화면 갱신 (Realtime 연결은 `docs/decisions/0002-realtime.md`).
4. 친구 등록 → 두 브라우저 탭 → 토스트 → 레이스 화면의 "기록 보기" 로 `/records` 진입 → `/my/collection` 도감 확인.
5. Vercel 대시보드의 Cron Jobs 탭에 `/api/cron/settle` 이 `5 15 * * *` 로 등록됐는지 본다. `CRON_SECRET` 이 프로젝트 환경 변수에 없으면 엔드포인트가 500 을 돌려주고 정산이 돌지 않으므로, 값이 들어갔는지 함께 확인한다.

## Flutter 배포 빌드

```
flutter build ios     --dart-define=WEB_URL=https://<production-domain>
flutter build apk     --dart-define=WEB_URL=https://<production-domain>
```

## 조회 효율 개선 검증 (2026-09-20)

[ADR 0007](decisions/0007-shared-realtime-and-query-reconciliation.md)의 단일 Provider와 사용자별 캐시를 적용했다. 로컬 테스트 DB를 사용했으며 스키마·Flutter 변경은 없다.

아래 수치는 **실제 QueryClient·Provider와 가짜 SDK/HTTP를 사용하는 가상 시간 통합 테스트** 결과다. 운영 네트워크에서 측정한 요청량·전송량·응답 시간이 아니다. 초기 연결 보정 이후 집계했다.

| 조건 | race GET | friends GET | unread GET |
| --- | ---: | ---: | ---: |
| 정상 연결, 홈·랭킹 각각 idle 5분 | 5 | 5 | 5 |
| 정상 연결, 친구·오늘·도감 각각 idle 5분 | 0 | 5 | 5 |
| 레이스 이벤트가 매초 도착하는 2분 | 2 | 2 | 2 |
| 숨김 60초 | 0 | 0 | 0 |
| 오프라인 65초 | 0 | 0 | 0 |
| 가시성·네트워크·연결 복귀가 겹친 보정 | 1 | 1 | 1 |

장애 시 레이스 2초, 친구 20초, 미읽음 5초 폴링을 유지한다. 친구 채널만 실패해도 레이스는 장애 주기를 적용한다. 실시간·낙관적 캐시 갱신이 조회 타이머를 연기하지 않으며, 복귀 직후 이벤트가 도착해도 전체 조회를 생략하지 않는다.

실제 Chromium + 로컬 개발 서버에서 회원가입 → 탭 저장 → 레이스·랭킹·친구·오늘·도감 이동 → 정산 → 레이스 버튼 잠금 → 로그아웃 → 다른 계정 가입(횟수 0)을 확인했다. 브라우저 콘솔 오류는 없었다. 테스트 계정은 로컬 DB에서 정리했다.

로컬 `SUPABASE_SECRET_KEY`가 없어 실제 서버 broadcast·WebSocket 연결 검증은 수행하지 않았다. 브라우저 검증에서는 폴링 모드가 정상 동작했다. 동일 production 조건의 전후 5분 측정, 두 기기 사이 실제 이벤트 전달, 종료된 앱의 FCM/APNs 수신은 **미검증**이다. 서버 전달·읽음 소유권·ACK 재시도는 자동 테스트로 검증했다.

### Preview 및 운영 반영 절차

1. Preview의 URL·publishable·secret 세 환경 변수를 확인한다. 공개 변수는 빌드에 포함되므로 변경 후 재배포한다. Vercel의 서버 환경 변수 변경도 새 배포에 반영한다. 키 값은 로그·HAR·문서에 남기지 않는다.
2. 내 채널과 필요한 모든 친구 채널이 SUBSCRIBED인지, 서버 broadcast가 수락되는지 확인한다. 키 누락·구독 장애 상태를 정상 연결의 성능 측정과 섞지 않는다.
3. [계획 Task 6](superpowers/plans/2026-09-20-query-efficiency.md#task-6-환경-확인통합-검증성능-측정)에 따라 기준 버전과 변경 버전을 같은 빌드·친구 수·연결 상태에서 각각 5분 측정한다. GET와 신호 ACK POST를 별도 집계한다. 전송량·응답 시간은 이때 실측한다.
4. 두 테스트 계정의 탭·친구 요청/수락/삭제/차단, 전체/일부 채널 장애와 재연결을 확인하고, FCM/APNs 테스트 기기로 앱 종료 상태의 푸시 수신을 확인한다.
5. Preview 검증 후 기존 배포 절차로 적용한다. 반복 재연결, 푸시 누락, 카운트 역행이 발생하면 마지막 정상 배포로 되돌린다. 이번 변경에는 DB 마이그레이션이 없으므로 앱 배포만 복구한다.

이번 작업에서는 배포·환경 변수 변경을 수행하지 않았다.

검사 결과: `pnpm typecheck`, `pnpm lint`, `pnpm test` (23개 파일, 153개 테스트), `pnpm build` 모두 통과했다. 컨트롤러·SDK 어댑터·Provider·알림의 별도 코드 리뷰 지적 사항도 수정 후 재검증했다.
