import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./server";

export type CurrentUser = { id: string; name: string; username: string };

/** route handler 는 request.headers, 서버 컴포넌트는 await headers() 를 넘긴다 */
export async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
  };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요해요");
  }
}

export async function requireUser(headers: Headers): Promise<CurrentUser> {
  const user = await getCurrentUser(headers);
  if (!user) throw new UnauthorizedError();
  return user;
}

/** 서버 컴포넌트(페이지)용. 세션이 없으면 /login 으로 보낸다 */
export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  return user;
}
