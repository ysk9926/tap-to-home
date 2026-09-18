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
| `DIRECT_URL` | 불필요 (빌드에서 마이그레이션 안 함. `postinstall` 의 `prisma generate` 는 DB 에 접속하지 않음) | 불필요 |
| `BETTER_AUTH_SECRET` | 새로 생성 | Production 과 다른 값 |
| `BETTER_AUTH_URL` | `https://<production-domain>` | 비움 → 코드가 `VERCEL_URL` 로 대체 |
| `NEXT_PUBLIC_APP_URL` | `https://<production-domain>` | 비움 가능 |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 값 | 동일 |
| `SUPABASE_SECRET_KEY` | Supabase 값 | 동일 |

`vercel.json` 은 리전만 고정한다(`icn1`). 나머지는 대시보드 설정.

## 배포 후 확인

1. `https://<domain>/api/auth/ok` 가 200 → better-auth 기동.
2. 회원가입 → Supabase Table Editor 의 `user` 에 행이 생김.
3. 두 브라우저에서 레이스 화면을 열고 탭 → 상대 화면 갱신 (Realtime 연결은 `docs/decisions/0002-realtime.md`).

## Flutter 배포 빌드

```
flutter build ios     --dart-define=WEB_URL=https://<production-domain>
flutter build apk     --dart-define=WEB_URL=https://<production-domain>
```
