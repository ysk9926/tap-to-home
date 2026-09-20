import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; username: string };

/** route handler 는 request.headers, 서버 컴포넌트는 await headers() 를 넘긴다 */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  // 탈퇴한 계정은 세션이 살아 있어도 로그인 상태가 아니다 (소프트 삭제).
  // better-auth 는 세션 조회 시 deletedAt 을 보지 않으므로 여기서 한 번 더 확인한다.
  const active = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!active) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
  };
}

/** 서버 컴포넌트(페이지)용. 세션이 없으면 /login 으로 보낸다 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  return user;
}
