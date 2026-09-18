import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

// 서버 전용. 클라이언트 컴포넌트에서는 ./client 를 사용한다.
export const auth = betterAuth({
  // Vercel: production 은 BETTER_AUTH_URL 을 명시하고, preview 배포는 VERCEL_URL 로 대체한다.
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  secret: process.env.BETTER_AUTH_SECRET,
  // preview 배포 도메인에서 쿠키·CSRF 검사가 통과하도록
  trustedOrigins: ["https://*.vercel.app"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // 대회 기간 한시적 개방형 로그인: 이메일+비밀번호. 소셜 로그인은 socialProviders 에 추가.
  emailAndPassword: {
    enabled: true,
  },
  // server action / RSC 안에서 set-cookie 가 동작하도록. 반드시 plugins 배열의 마지막.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
