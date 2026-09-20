export class AdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function adminOrigin(): string {
  const value = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return new URL(value).origin;
}

export function assertAdminOrigin(request: Request): void {
  if (request.headers.get("origin") !== adminOrigin()) {
    throw new AdminError(403, "허용되지 않은 요청입니다");
  }
}

export function adminSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret === process.env.BETTER_AUTH_SECRET) {
    throw new AdminError(503, "관리자 인증 설정이 필요합니다");
  }
  return secret;
}
