# ADR 0003 — ORM: Drizzle → Prisma 7

날짜: 2026-09-19 · 상태: 채택

## 결정

Drizzle ORM 을 Prisma 7 (+ `@prisma/adapter-pg`) 로 교체한다. better-auth 는 `prismaAdapter(prisma, { provider: "postgresql" })` 를 쓴다.

## 이유

- Supabase 대시보드의 ORM 가이드가 Prisma 기준이고, 팀이 Prisma 를 쓰기로 했다.
- Prisma 7 은 Rust 엔진 없이 driver adapter(`pg`)로 동작해 Vercel 서버리스 번들이 가볍다.

## Prisma 7 에서 달라진 점 (학습 데이터의 Prisma 5/6 과 다름)

- 연결 URL 은 `schema.prisma` 의 `datasource` 가 아니라 `prisma.config.ts` 의 `datasource.url` 에 둔다. `directUrl` 옵션은 없다. 대신 config 가 `DIRECT_URL` 을 읽고, 런타임 클라이언트가 `DATABASE_URL` 을 읽는 식으로 분리한다.
- generator 는 `prisma-client` (구 `prisma-client-js` 아님). 산출물은 `src/generated/prisma/` 이고 git 에 넣지 않으며 `postinstall` 에서 생성한다.
- `PrismaClient` 는 반드시 `adapter` 를 받는다: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
- Supabase transaction pooler(6543) 에는 `?pgbouncer=true` 를 붙인다. 마이그레이션은 session pooler(5432) 로만 실행한다.

## 결과

- 스크립트: `db:migrate`(migrate dev) / `db:deploy`(migrate deploy) / `db:push` / `db:studio` / `db:generate`.
- 초기 마이그레이션 `prisma/migrations/*_init` 이 Supabase 프로젝트에 적용됨.
