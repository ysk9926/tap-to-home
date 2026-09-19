# Tap to Home

하루 종일 퇴근만 기다리는 직장인을 위한 "퇴근 레이스" 소셜 앱. 버튼을 연타하면 내 졸라맨이 회사에서 집으로 전진하고, 친구들과 실시간 대결하며, 하루 끝에 칭호를 받는다. 원티드 AI 챔피언십 2026 출품작. 목표와 범위는 `docs/goal.md` 가 기준이다.

## 레이아웃

```
app/web      Next.js 16 (App Router, src/) — 모든 기능·화면·API 는 여기서 구현
app/mobile   Flutter — app/web 을 띄우는 웹뷰 셸. 기능 로직을 넣지 않는다
docs/        기획·기술 결정의 단일 기준 (goal, features, data-model, deploy, decisions/)
packages/    web 외 워크스페이스 패키지가 생기면 여기 (현재 없음)
```

pnpm 워크스페이스 루트는 이 디렉토리. `app/mobile` 은 pnpm 과 무관하다.

## 작업 규칙

- 기능 추가 전 `docs/features.md` 에서 해당 F1~F3 요구사항을 읽고, 없는 요구사항은 먼저 문서에 추가한 뒤 구현한다.
- 테이블을 추가·변경할 때 `docs/data-model.md` 를 먼저 고치고, `app/web/prisma/schema.prisma` 에 반영하고, `pnpm db:migrate` 로 마이그레이션을 만들어 적용한다. `db:push` 는 로컬 실험용이다.
- 기술 선택을 바꾸거나 새로 하면 `docs/decisions/` 에 ADR 을 한 개 추가한다. 번호는 다음 순번.
- 웹은 `app/web/AGENTS.md` 의 Next.js 16 안내를 따른다. 학습 데이터의 Next.js 와 다르다.
- DB 는 Supabase Postgres 지만 접근은 Prisma(서버, `src/lib/db`)로만 한다. supabase-js 는 Realtime 채널에만 쓰고, Supabase Auth·RLS·PostgREST 로 데이터를 읽지 않는다. 연결 문자열 규칙(pooler 포트)은 `docs/deploy.md`.
- 모바일은 웹뷰만 유지한다. 네이티브가 꼭 필요한 것(푸시 토큰, 햅틱)은 `lib/main.dart` 의 `TapToHome` JS 채널로 웹에서 호출한다.
- 사용자 대면 문구는 한국어, 코드·식별자·커밋 메시지는 영어.

## 명령

루트 `package.json` 의 scripts 가 진입점이다. 자주 쓰는 것:

```
pnpm install            # 워크스페이스 전체
pnpm db:up              # 로컬 PostgreSQL (docker compose). 기본 .env 는 Supabase 를 가리킴
pnpm dev                # web 개발 서버 (http://localhost:3000)
pnpm typecheck && pnpm lint
pnpm test               # vitest (통합 테스트는 pnpm db:up 필요)
pnpm mobile:run         # flutter run (WEB_URL 은 --dart-define 로 주입)
```

첫 실행: `cp app/web/.env.example app/web/.env` 후 `BETTER_AUTH_SECRET` 을 채운다.

## 완료 기준

변경을 끝냈다고 말하기 전에 `pnpm typecheck`, `pnpm lint`, `pnpm test` 가 통과해야 한다. 스키마를 건드렸으면 `pnpm db:migrate` 가 만든 `prisma/migrations/*` 파일이 커밋에 포함돼야 한다. Flutter 를 건드렸으면 `flutter analyze` 가 통과해야 한다.
