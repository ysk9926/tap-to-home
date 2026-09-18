import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  // Supabase transaction pooler(6543) 를 가리키는 DATABASE_URL 사용.
  // Vercel 서버리스는 인스턴스마다 풀이 생기므로 max 를 작게 둔다.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// dev HMR 시 클라이언트가 중복 생성되지 않도록 globalThis 에 보관
export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
