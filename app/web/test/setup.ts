import "dotenv/config";

// 통합 테스트는 로컬 docker Postgres(pnpm db:up)를 쓴다. .env 의 DATABASE_URL(Supabase)을 덮어쓴다.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://taptohome:taptohome@localhost:5432/taptohome";
