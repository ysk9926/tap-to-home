"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Realtime(broadcast) 전용 브라우저 클라이언트. Supabase Auth 는 쓰지 않는다 — 세션은 better-auth.
// DB 읽기·쓰기도 이 클라이언트로 하지 않는다 (RLS 를 열지 않았으므로 publishable 키로는 아무것도 못 읽는 게 정상).
let client: SupabaseClient | undefined;

export function getSupabaseRealtime() {
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    },
  ));
}
