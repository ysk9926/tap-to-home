import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);

/**
 * 낙관적 인증 검사: 세션 쿠키가 없으면 /login 으로. 실제 검증은 각 페이지·API 의 getSession.
 * /dev/ui 와 /api/auth 는 matcher 에 없으므로 통과한다.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/friends", "/today", "/collection", "/login", "/signup"],
};
