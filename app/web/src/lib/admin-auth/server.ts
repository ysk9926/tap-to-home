import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { adminOrigin, adminSecret } from "./config";

function createAdminAuth(secret: string, origin: string) {
  return betterAuth({
    appName: "Tap to Home Admin", baseURL: origin, basePath: "/api/admin/auth", secret,
    trustedOrigins: [origin],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    user: { modelName: "adminUser" },
    session: {
      modelName: "adminSession", expiresIn: 8 * 60 * 60,
      disableSessionRefresh: true, cookieCache: { enabled: false },
    },
    account: { modelName: "adminAccount", accountLinking: { enabled: false } },
    verification: { modelName: "adminVerification" },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    advanced: { cookiePrefix: "tth-admin", defaultCookieAttributes: { sameSite: "strict" } },
    // The public handler uses an atomic database-backed limiter, shared across instances.
    rateLimit: { enabled: false },
    databaseHooks: { session: { create: { before: async (session) => {
      const master = await prisma.adminUser.findFirst({ where: { id: session.userId, disabledAt: null } });
      if (!master || master.id !== "master") {
        throw new APIError("UNAUTHORIZED", { message: "아이디 또는 비밀번호를 확인해 주세요" });
      }
      return { data: session };
    } } } },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30, usernameValidator: (value) => /^[a-z0-9_]+$/i.test(value) })],
  });
}

let instance: ReturnType<typeof createAdminAuth> | undefined;
let configuration = "";
/** Lazy: an unset admin secret disables admin routes, not the public application/build. */
export function getAdminAuth() {
  const secret = adminSecret();
  const origin = adminOrigin();
  if (!instance || configuration !== `${origin}:${secret}`) {
    instance = createAdminAuth(secret, origin);
    configuration = `${origin}:${secret}`;
  }
  return instance;
}
