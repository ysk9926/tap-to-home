import "dotenv/config";
import { defineConfig } from "prisma/config";

// CLI(migrate/studio) 전용 설정. 런타임 클라이언트는 src/lib/db/index.ts 에서 DATABASE_URL 을 쓴다.
// 마이그레이션은 transaction pooler(6543) 로 돌릴 수 없으므로 DIRECT_URL(session pooler 5432)을 쓴다.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
