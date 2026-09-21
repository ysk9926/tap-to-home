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

프로젝트 이름 `tap-to-home-web`, production 도메인 `https://taptohome.site`. 기존 `https://tap-to-home-web.vercel.app`은 설치된 웹뷰 앱을 위해 유지하며 정산 경로를 제외하고 새 주소로 이동시킨다(ADR 0012). 환경 변수는 `app/web` 에서 `npx vercel link --project tap-to-home-web` 후 `vercel env add <NAME> <production|preview>` 로 넣는다(비밀값은 `--sensitive`).

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
| `ADMIN_AUTH_SECRET` | 일반 인증과 다른 32자 이상 랜덤 값 | Production과 다른 값 |
| `BETTER_AUTH_URL` | `https://<production-domain>` | 비움 → 코드가 `VERCEL_URL` 로 대체 |
| `NEXT_PUBLIC_APP_URL` | `https://<production-domain>` | 비움 가능 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 값 | 동일 |
| `SUPABASE_SECRET_KEY` | Supabase 값 | 동일 |
| `DEV_UI_KEY` | `/dev/ui` 레퍼런스 페이지 열쇠 (ADR 0004). 값을 넣으면 `?key=<값>` 으로 열리고, 지우면 닫힌다 — 닫을 때 재배포는 필요 없다. `openssl rand -hex 16` | Preview 도 production 빌드라 가드가 걸린다. 미리보기에서 열어야 하면 Production 과 다른 값을 넣는다 |
| `CRON_SECRET` | 자정 정산 크론(`/api/cron/settle`) 인증. Vercel 프로젝트 설정에 넣으면 Cron 요청에 자동으로 실린다. 값이 없으면 엔드포인트가 500 을 돌려주고 정산이 돌지 않는다 (ADR 0008) | 필요 시 별도 값 |

실제 배포 설정은 `app/web/vercel.json`이며 리전(`icn1`)과 자정 정산 크론(`/api/cron/settle`, `5 15 * * *`)을 등록한다. 루트 `vercel.json`도 같은 값을 유지한다. 루트 파일에만 Cron을 추가하면 Root Directory가 `app/web`인 Git 배포에서 누락될 수 있다. 나머지는 대시보드 설정.

Prisma 클라이언트는 `src/generated/prisma` 에 생성되고 커밋하지 않는다. Vercel 은 빌드 캐시로 `node_modules` 를 복원하면 설치를 건너뛰어 `postinstall` 이 돌지 않으므로, 생성은 `build` 스크립트 앞단(`prisma generate && next build`)에서 한다. `postinstall` 은 로컬 설치 편의를 위해 남겨둔다.

## 운영 도메인 (가비아 DNS)

2026-09-21 기준 `taptohome.site`는 가비아 네임서버를 사용하고 다음 Vercel 권장 A 레코드로 연결한다. Vercel의 권장 값이 변경되면 `vercel domains verify taptohome.site`로 다시 조회한다.

| 타입 | 호스트 | 값 | TTL |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | 600 |
| A | `@` | `64.29.17.1` | 600 |

Vercel이 HTTPS 인증서를 자동 발급·갱신하고 HTTP 접속도 HTTPS로 이동시킨다. Production의 `BETTER_AUTH_URL`과 `NEXT_PUBLIC_APP_URL`은 `https://taptohome.site`로 설정하고 웹을 재배포한다. 기존 도메인의 로그인 쿠키는 공유되지 않으므로 전환 후 다시 로그인한다.

기존 운영 주소의 이동은 `next.config.ts`에서 처리한다. 경로·쿼리를 보존하는 307이며 `/api/cron`과 하위 경로는 제외한다. Vercel Domains에서 기존 주소 전체에 리다이렉트를 추가하지 않는다. Preview 주소는 이동하지 않으며 해당 환경의 인증 주소 설정도 별도로 유지한다.

배포 후 기존 주소의 `/`, `/login`, `/records/<날짜>?from=push`가 새 도메인으로 이동하는지 확인한다. `/api/cron/settle`은 인증 없이 호출할 때 401이어야 하며, 3xx는 잘못된 리다이렉트, 500은 `CRON_SECRET` 누락 등 별도 운영 설정 문제다. 이 확인을 위해 실제 정산을 실행하지 않는다.

CLI 배포는 워크스페이스 루트에서 `npx vercel deploy --prod --project tap-to-home-web --local-config app/web/vercel.json`으로 실행한다. 프로젝트 Root Directory가 `app/web`이므로 그 하위 디렉토리에서 실행하면 경로가 중복될 수 있다. 루트 `.vercelignore`는 로컬 환경 변수 파일·모바일·문서 산출물을 업로드에서 제외한다.

2026-09-21 도메인 전환 전 운영 배포(`dpl_6c52PiUPnqFFaqrtsMkEKfn8FPjn`)는 Cron 정의가 비어 있었고 Production에 `CRON_SECRET`도 없었다. 당시 루트 `vercel.json`의 스케줄과 달리 실제 배포에 쓰인 `app/web/vercel.json`에는 Cron이 없었다. 도메인 전환에서는 이 기존 상태를 유지했고, 후속 복구에서 실제 배포 설정에 Cron을 추가하고 Production 인증키를 별도로 설정했다.

전환 배포 `dpl_5ufnkM4TVAfJkb1fsCTe9ZhaNpcr`를 운영으로 승격했다. 두 공용 DNS 조회에서 A 레코드를 확인했고 HTTPS·HTTP→HTTPS·기존 호스트의 경로/쿼리 보존을 검증했다. 임시 계정으로 새 origin의 가입→로그아웃→아이디 로그인→세션 조회→인증된 홈 렌더링→로그아웃을 확인한 뒤 해당 계정만 삭제했다. 배포된 `favicon.ico`·`icon.png`·`apple-icon.png`의 SHA-256은 로컬과 일치한다. 타입 검사·린트·264개 테스트와 로컬/Vercel 프로덕션 빌드가 통과했다. 기존 Android·iOS 설치 파일의 실기기 확인은 이 검증에 포함하지 않았다.

## 자정 정산 운영 확인

- `app/web/vercel.json`과 루트 설정의 `/api/cron/settle` 스케줄은 UTC `5 15 * * *`다. Vercel 프로젝트의 활성 Cron 정의와 실제 운영 deployment ID도 함께 확인한다.
- 2026-09-21 확인한 팀 요금제는 Hobby다. 설정은 KST 00:05지만 [Hobby의 시간 단위 실행 정확도](https://vercel.com/docs/cron-jobs/usage-and-pricing#hobby-scheduling-limits) 때문에 정확한 분은 보장되지 않는다. 날짜 경계 이후인 00시대에 전날 정산을 수행한다.
- `CRON_SECRET`은 충분히 긴 무작위 값으로 생성해 Production의 Secret 타입 환경 변수에 저장한다. 값은 소스·문서·로그에 남기지 않는다. Vercel은 이 값을 Cron 요청의 Bearer 인증 헤더로 보낸다.
- 배포 후 새 도메인과 기존 Vercel 주소 양쪽에서 인증 없는 요청·틀린 인증키 요청이 리다이렉트 없이 401을 반환해야 한다. 500은 인증키 미설정 상태다.
- 정산 로직·0회 사용자 제외·재실행 중복 방지는 로컬 DB 통합 테스트로 검증한다. 운영 `/api/cron/settle`을 올바른 인증키로 직접 호출하면 실제 정산과 푸시가 발생하므로 단순 설정 확인용으로 실행하지 않는다.
- 매일 실행되는 작업은 직전 KST 날짜만 처리한다. 스케줄 복구가 과거 미정산 기록을 소급 처리하지는 않는다.

2026-09-21 복구 배포 `dpl_6Qjcr7WW5wya9CitXbt6XSd1ZRBN`를 운영으로 승격했다. Vercel API에서 활성 Cron 정의 1건(`5 15 * * *`, `/api/cron/settle`)과 해당 deployment ID, Production의 sensitive `CRON_SECRET` 등록을 확인했다. 신규·기존 도메인의 인증 누락/잘못된 인증 요청은 모두 리다이렉트 없이 401을 반환한다. 로그인 헬스 체크 200과 기존 주소 이동도 유지되며 타입 검사·린트·264개 테스트·Vercel 빌드가 통과했다. 실제 정산·푸시를 일으키는 수동 호출은 하지 않았고 첫 예약 실행은 별도로 확인해야 한다.

복구 시 조회한 과거 미정산은 2026-09-19 3건, 2026-09-20 7건이다. 과거 기록 소급 정산은 설정 복구와 별도로 범위를 확인 중이며, 이 배포에서는 데이터를 변경하지 않았다.

## 앱 배포 전 DB 확인

`prisma generate`와 Vercel 빌드 성공은 운영 DB에 마이그레이션이 적용됐다는 뜻이 아니다. 새 코드가 사용할 컬럼·테이블은 앱 배포 전에 대상 DB에 적용해야 한다.

1. 대상 환경의 `DIRECT_URL`을 사용해 `pnpm --filter web exec prisma migrate status`를 실행한다. 출력되는 호스트·DB명이 배포 대상인지 확인한다.
2. 미적용 마이그레이션의 SQL을 검토하고 `pnpm db:deploy`로 적용한다. 운영 DB에서 `db:push`나 `migrate dev`를 실행하지 않는다.
3. 상태를 다시 조회해 `Database schema is up to date!`를 확인한 뒤 앱을 배포한다. Preview가 운영 DB를 공유하는 경우에도 같은 순서를 따른다.

2026-09-21에는 `20260920093058_admin_dashboard`가 미적용된 상태로 앱이 배포되어, 세션의 사용자 조회가 `P2022: user.suspendedAt does not exist`로 실패했다. Better Auth가 이를 `FAILED_TO_GET_SESSION`으로 감싸면서 로그인 사용자의 `/` 렌더링이 500으로 중단됐다. 해당 마이그레이션을 `pnpm db:deploy`로 적용해 복구했다. 기존 데이터 삭제나 앱 재배포는 필요하지 않았다.

## 배포 후 확인

### 친구 TOP2 레일 표시 설정 배포 (2026-09-21)

`20260921072526_add_top_friend_rails_preference`를 운영 Supabase에 `pnpm db:deploy`로 적용하고, 7개 마이그레이션이 모두 적용된 상태를 확인했다. 기존·신규 사용자의 `showTopFriendRails` 기본값은 `true`다.

Vercel 배포 `dpl_8sqwmGvnPUHCuo4VmohWRqMTramg`가 Production `READY`이며 `https://taptohome.site`와 기존 Vercel 도메인이 이 배포를 가리킨다. 빌드가 통과했고, 기존 주소의 경로·쿼리 보존 리다이렉트와 두 도메인의 정산 API 인증 검사(인증 없는 요청 401)를 확인했다.

운영 Chromium에서 임시 계정으로 가입·세션 조회, TOP2 기본 표시, 마이페이지에서 끄기, 메인 이동·새로고침 후 숨김 유지, 전체 랭킹 표시 유지, 로그아웃·재로그인 후 설정 유지, 다시 켜기와 두 레일 복원을 확인했다. DB에서도 본인 설정 저장과 다른 두 계정의 기본값 유지를 확인했다. 검증에 만든 계정 3개와 연결된 데이터는 정리했다. 정산·푸시를 수동 실행하지 않았다.

### 공통 확인 항목

1. `https://<domain>/api/auth/ok` 가 200 → better-auth 기동. 이 응답과 비로그인 `/login`·`/signup`의 200만으로는 DB·세션 조회를 검증할 수 없다. 로그인 세션으로 `/`를 새로고침해 레이스가 표시되는지, `/api/auth/get-session`이 200과 사용자·세션을 반환하는지도 확인한다.
2. 회원가입(아이디) → `user` 에 `username` 행.
3. 두 브라우저에서 레이스 화면을 열고 탭 → 상대 화면 갱신 (Realtime 연결은 `docs/decisions/0002-realtime.md`).
4. 친구 등록 → 두 브라우저 탭 → 토스트 → 레이스 화면의 "기록 보기" 로 `/records` 진입 → `/my/collection` 도감 확인.
5. Vercel 대시보드의 Cron Jobs 탭에 `/api/cron/settle` 이 `5 15 * * *` 로 등록됐는지 본다. `CRON_SECRET` 이 프로젝트 환경 변수에 없으면 엔드포인트가 500 을 돌려주고 정산이 돌지 않으므로, 값이 들어갔는지 함께 확인한다.

## Flutter 배포 빌드

```
flutter build ios     --dart-define=WEB_URL=https://<production-domain>
flutter build apk     --dart-define=WEB_URL=https://<production-domain>
```

## 관리자 페이지 배포·초기 설정 (F5, ADR 0010)

관리자 로그인은 `/admin/login`, 대시보드는 `/admin`이다. 일반 계정으로는 접근할 수 없다. 회원가입 화면에서 마스터를 생성하지 않는다.

1. 대상 DB를 확인하고 새 앱 배포 전에 `pnpm db:deploy`로 `20260920093058_admin_dashboard` 및 이후 마이그레이션을 적용한다. 로컬 개발용 생성·적용 명령은 `pnpm db:migrate`다.
2. 대상 환경에 `ADMIN_AUTH_SECRET`을 넣는다. `openssl rand -base64 32`로 생성하며 `BETTER_AUTH_SECRET`과 달라야 한다. 비밀키가 없거나 짧으면 일반 앱은 계속 동작하고 관리자 인증은 설정 필요 응답을 반환한다.
3. `BETTER_AUTH_URL`을 실제 접속 출처로 맞춘다. Preview에서 비워 둔 경우 `VERCEL_URL`을 사용한다. 관리자 요청에는 출처 검사가 적용되므로 다른 도메인으로 접속하면 로그인·변경 요청이 거절된다.
4. 아래 명령을 대화형 터미널에서 실행한다. `app/web/.env`의 `DATABASE_URL`을 읽으며 처음 출력되는 DB 호스트·DB명을 확인한다. 비밀번호는 화면에 표시되지 않는다.

```sh
pnpm admin:master create
```

마스터 아이디는 영문·숫자·`_` 3~30자, 비밀번호는 12~128자다. 계정이 이미 있으면 변경 없이 종료한다. 배포·마이그레이션 실행만으로 마스터가 생성되지 않는다.

비밀번호를 잊었거나 교체할 때는 `pnpm admin:master reset`을 사용한다. 새 비밀번호 입력 후 `RESET`을 확인하면 모든 관리자 세션이 만료되고 비활성화된 마스터도 복구된다. 긴급 중지에는 `pnpm admin:master disable`을 실행하고 `DISABLE`을 확인한다. 이 절차는 일반 사용자 계정·세션에 영향을 주지 않는다.

마스터 로그인은 서버 간 공유하는 DB 제한으로 전체 1분에 10회까지 허용한다. 단일 운영자용 제한으로, 한 곳에서 시도가 몰리면 다른 브라우저도 최대 1분 기다릴 수 있다. 세션은 로그인 시점부터 최대 8시간이며 자동 연장하지 않는다. 관리자 인증 응답·조회 응답은 private/no-store다.

방문·행동 수집을 처음 실행하면 `analytics_config.startedAt`을 기록한다. 과거 탭 기록은 플레이 통계로만 읽으며 방문 기록으로 변환하지 않는다. 수집 전 구간·불완전한 D1/D7·7일/30일 창은 `수집 중`으로 표시한다. 결과 상세 열람률도 계측 이전 기간을 포함하면 표시하지 않는다. 기본 최근 7일에 가입한 코호트는 D7 관찰이 아직 끝나지 않으므로, D7 비교에는 최근 30일·90일 조회를 사용한다. 운영 테스트용 일반 계정은 사용자 상세의 분석 제외 조치로 통계에서 뺄 수 있다. 제외 변경에는 사유와 감사 이력이 남고, 해당 계정의 방문 원본은 유지한다.

로컬 테스트 DB에서는 마스터 초기화·재설정 테스트가 일시적인 마스터를 만들고 정리한다. 이미 운영용 마스터가 있는 DB에는 해당 테스트를 실행하지 말고 별도 `TEST_DATABASE_URL`을 사용한다. 원격 DB 마이그레이션·실제 마스터 생성·운영 배포는 릴리스 시 수행한다.

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
