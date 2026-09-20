# Tech Stack

| 영역 | 선택 | 버전 (2026-09 기준) | 이유 |
| --- | --- | --- | --- |
| 모노레포 | pnpm workspaces | pnpm 11 | 워크스페이스 하나(app/web)로 충분. Turborepo 는 패키지가 늘면 도입 |
| 웹 | Next.js App Router, React, TypeScript | Next 16.3, React 19.2 | Vercel 배포 및 RSC. `app/web/AGENTS.md` 의 문서 안내 필수 |
| 서버 상태 | TanStack Query | v5 | 레이스·랭킹 폴링/실시간 캐시, 낙관적 업데이트 |
| 스타일 | Tailwind CSS | v4 | 테마 토큰은 `globals.css` `@theme` 에 정의 |
| 인증 | better-auth 1.7 (+ username 플러그인) | 1.7 | 아이디+비밀번호 개방형 로그인, Prisma 어댑터 |
| 관리자 인증 | 독립 better-auth 인스턴스·마스터 계정 | 1.7 | `/admin/login`, 별도 인증 테이블·쿠키·세션 (ADR 0010) |
| 관리자 차트 | react-chartjs-2 + Chart.js | 5 / 4 | 일별 추이·구간 도달·활성화·소셜 분석, 데이터 표 병행 (ADR 0009) |
| 운영 CLI | tsx | 4 | 마스터 생성·비밀번호 재설정·비활성화용 TypeScript 명령 실행 |
| DB | PostgreSQL (Supabase) | 17 | 로컬은 docker compose, 배포는 Supabase Postgres. 연결 규칙은 `deploy.md` |
| 실시간 | Supabase Realtime (broadcast) | supabase-js 2 | 친구 위치 전파. Supabase Auth/RLS 는 사용 안 함 (`decisions/0002`) |
| ORM | Prisma 7 + @prisma/adapter-pg | 7.10 | better-auth 공식 어댑터, `prisma/migrations` 에 SQL 이 남음. 연결 URL 은 `prisma.config.ts` (`decisions/0003`) |
| 모바일 | Flutter + webview_flutter | Flutter 3.44 | 웹을 감싸는 셸. iOS/Android |
| 배포 | Vercel (web, icn1) + Supabase (ap-northeast-2) | | 설정 절차는 `deploy.md` |
| AI 활용 | Midjourney (줄노트 배경·졸라맨 에셋), Claude Code / Cursor (구현) | | |

## 환경 변수

`app/web/.env.example` 이 기준. 새 변수를 추가하면 그 파일과 이 표를 같이 갱신한다.

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | 앱 런타임 연결 (Supabase 는 transaction pooler 6543) |
| `DIRECT_URL` | prisma migrate 연결 (Supabase 는 session pooler 5432). `prisma.config.ts` 가 읽는다 |
| `TEST_DATABASE_URL` | vitest 통합 테스트용 로컬 Postgres (기본 docker compose 값) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 Realtime 구독 |
| `SUPABASE_SECRET_KEY` | 서버에서 채널 브로드캐스트. 서버 전용 |
| `BETTER_AUTH_SECRET` | 세션 서명 키 (`openssl rand -base64 32`) |
| `ADMIN_AUTH_SECRET` | 일반 인증 키와 다른 32자 이상 관리자 전용 비밀키. 미설정 시 관리자 인증만 503 |
| `BETTER_AUTH_URL` | 서버가 인식하는 자신의 URL |
| `NEXT_PUBLIC_APP_URL` | 브라우저·웹뷰가 접근하는 URL |

## 모바일 웹뷰 주의점

- 웹 URL 은 `--dart-define=WEB_URL=...` 로 주입. Android 에뮬레이터는 `10.0.2.2`, iOS 시뮬레이터는 `localhost`.
- 로컬 http 접근을 위해 iOS `NSAllowsLocalNetworking`, Android `INTERNET` 권한이 설정돼 있다. 배포 빌드는 https 만 쓴다.
- 웹 → 네이티브 호출은 `window.TapToHome.postMessage(JSON.stringify({...}))`. 네이티브 → 웹은 `runJavaScript`.
