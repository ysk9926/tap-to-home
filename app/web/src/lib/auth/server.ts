import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { prisma } from "@/lib/db";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/i;

// 서버 전용. 클라이언트 컴포넌트에서는 ./client 를 사용한다.
export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: ["https://*.vercel.app"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // 아이디 로그인(docs/decisions/0005). 플러그인이 /sign-up/email 을 재사용하므로 켜 둔다.
  // email 은 placeholderEmail() 로 자동 생성한다.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: { session: { create: { before: async (session) => {
    const active = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null, suspendedAt: null }, select: { id: true },
    });
    if (!active) throw new APIError("FORBIDDEN", { message: "이용할 수 없는 계정입니다" });
    return { data: session };
  } } } },
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
    }),
    // server action / RSC 안에서 set-cookie 가 동작하도록. 반드시 plugins 배열의 마지막.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
