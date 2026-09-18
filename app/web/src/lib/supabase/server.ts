import "server-only";
import { createClient } from "@supabase/supabase-js";

// 서버에서 채널로 브로드캐스트할 때 사용 (탭 저장 후 친구들에게 위치 전파).
// secret 키(sb_secret_...)는 서버 전용이며 NEXT_PUBLIC_ 접두사를 붙이면 안 된다.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
