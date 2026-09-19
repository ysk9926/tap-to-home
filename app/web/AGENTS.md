<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# app/web

프로젝트 전체 규칙은 루트 `AGENTS.md`. 여기는 웹 앱에만 해당하는 내용.

## 구조

```
src/app/                 라우트. api/auth/[...all] 은 better-auth 핸들러
src/app/providers.tsx    TanStack Query provider (클라이언트 경계)
src/features/<domain>/   race | signal | titles | friends — 도메인별 컴포넌트·훅·서버 로직
src/components/          도메인 무관 공용 UI (줄노트·연필 스타일 프리미티브)
src/lib/db/index.ts      Prisma 클라이언트 (@prisma/adapter-pg, DATABASE_URL)
prisma/schema.prisma     모든 모델. 연결 URL 은 prisma.config.ts (DIRECT_URL)
prisma/migrations/       prisma migrate 가 생성. 손으로 고치지 않는다
src/generated/prisma/    prisma generate 산출물. git 에 넣지 않는다 (postinstall 에서 생성)
src/lib/auth/server.ts   better-auth 서버 인스턴스. server 전용
src/lib/auth/client.ts   better-auth React 클라이언트 (useSession 등)
src/lib/supabase/        Realtime 전용. client.ts(publishable, 브라우저 구독) / server.ts(secret, 브로드캐스트)
test/                    통합 테스트 (vitest + Postgres)
```

## 규칙

- 요청 전 처리는 `src/proxy.ts` (Next 16 은 `middleware.ts` 가 deprecated).
- 서버에서 세션은 `auth.api.getSession({ headers: await headers() })`, 클라이언트에서는 `useSession()`.
- 데이터 읽기는 서버 컴포넌트 또는 TanStack Query. 쓰기는 server action 또는 route handler. 같은 데이터를 두 경로로 읽지 않는다.
- 도메인 모델은 `prisma/schema.prisma` 에 `// ── <domain>` 구역으로 나눠 둔다. better-auth 모델(User/Session/Account/Verification)의 필드명은 better-auth 계약이므로 바꾸지 않는다.
- 쿼리는 `import { prisma } from "@/lib/db"`. 생성 클라이언트 경로(`@/generated/prisma/client`)는 타입 import 에만 쓴다.
- 버튼 연타가 핵심 인터랙션이므로 탭 핸들러는 낙관적 업데이트로 즉시 반응하고 서버 동기화는 배치한다 (`docs/decisions/0002-realtime.md`).
- 서비스 함수(`features/*/server/`)는 route handler 와 서버 컴포넌트가 함께 쓴다. 통합 테스트는 서비스 함수를 직접 부른다.
- 스타일은 Tailwind v4 + `globals.css` 의 테마 토큰. 임의 색상 값 대신 토큰(`bg-paper`, `text-pencil`, `border-marker`)을 쓴다.
- UI 를 만들기 전에 `docs/design.md` 를 읽고 `src/components/` 의 프리미티브(MarkerBox, MarkerButton, TapButton, Stickman 등)를 쓴다. 새 프리미티브는 `/dev/ui` (개발 전용) 에 상태별로 올린다.
