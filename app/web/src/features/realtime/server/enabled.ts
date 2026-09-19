import "server-only";

/**
 * secret key 가 비어 있으면 서버가 브로드캐스트를 못 보내므로, 브라우저도 구독하지 않고
 * 폴링을 유지한다 (broadcast.ts 와 동일한 조건).
 */
export function realtimeEnabled(): boolean {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
