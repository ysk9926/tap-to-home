import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 낙관적 인증 검사: 세션 쿠키가 없으면 /login 으로만 보낸다. 실제 검증(과 "이미 로그인함" 리다이렉트)은
 * 각 페이지의 getCurrentUser 몫이다. 쿠키는 있지만 DB 세션이 사라진 경우(데모용 DB 리셋 등) 이 프록시를
 * 통과해 페이지가 렌더되고, 페이지가 다시 /login 으로 보낸다 — 루프 없이 한 번에 끝난다.
 * /dev/ui, /login, /signup, /api/auth 는 matcher 에 없으므로 통과한다.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(getSessionCookie(request));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/friends", "/today", "/collection"],
};
