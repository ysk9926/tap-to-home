import "server-only";
import { prisma } from "@/lib/db";
import { AdminError, assertAdminOrigin } from "./config";
import { getAdmin } from "./current-admin";
import { getAdminAuth } from "./server";

const AUTH_PATHS = new Map([
  ["/api/admin/auth/sign-in/username", "POST"],
  ["/api/admin/auth/get-session", "GET"],
  ["/api/admin/auth/sign-out", "POST"],
]);

/** One master: a shared cap of 10 sign-in attempts per minute, without storing IPs. */
export async function consumeAdminLogin(now = new Date()): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO admin_login_attempt (key, "windowStartedAt", count) VALUES ('master-login', ${now}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN admin_login_attempt."windowStartedAt" <= ${new Date(now.getTime() - 60_000)} THEN 1 ELSE admin_login_attempt.count + 1 END,
      "windowStartedAt" = CASE WHEN admin_login_attempt."windowStartedAt" <= ${new Date(now.getTime() - 60_000)} THEN ${now} ELSE admin_login_attempt."windowStartedAt" END
    RETURNING count`;
  return rows[0].count <= 10;
}

export async function handleAdminAuth(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const method = AUTH_PATHS.get(path);
  const headers = { "Cache-Control": "private, no-store" };
  if (!method) return Response.json({ error: "없는 인증 경로입니다" }, { status: 404, headers });
  if (method !== request.method) return Response.json({ error: "허용되지 않은 메서드입니다" }, { status: 405, headers });
  try {
    if (request.method !== "GET") assertAdminOrigin(request);
    const auth = getAdminAuth();
    if (path.endsWith("sign-in/username") && !await consumeAdminLogin()) {
      return Response.json({ message: "로그인 시도가 많습니다. 1분 후 다시 시도해 주세요" }, {
        status: 429, headers: { ...headers, "Retry-After": "60" },
      });
    }
    if (path.endsWith("get-session") && !await getAdmin(request.headers)) {
      return Response.json(null, { headers });
    }
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "private, no-store");
    // Cookies carry authentication. Do not echo credential/session secrets into JSON.
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
      const body = await response.json();
      if (body && typeof body === "object") {
        delete body.token;
        if (body.session) { delete body.session.token; delete body.session.ipAddress; delete body.session.userAgent; }
        if (body.user) { delete body.user.email; delete body.user.emailVerified; }
      }
      response.headers.delete("content-length");
      return Response.json(body, { status: response.status, headers: response.headers });
    }
    return response;
  } catch (error) {
    const status = error instanceof AdminError ? error.status : 500;
    const message = error instanceof AdminError ? error.message : "관리자 인증을 처리하지 못했어요";
    return Response.json({ error: message, message }, { status, headers });
  }
}
