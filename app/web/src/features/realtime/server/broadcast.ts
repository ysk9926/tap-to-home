import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/** REST 로 채널에 한 번 쏜다. 키가 없거나 실패해도 요청 자체는 성공시킨다 (폴링이 받쳐준다) */
export async function broadcast(channel: string, event: string, payload: unknown): Promise<void> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const supabase = getSupabaseAdmin();
  const ch = supabase.channel(channel);
  try {
    const result = await ch.httpSend(event, payload, { timeout: 2000 });
    if (!result.success) console.warn(`[realtime] broadcast ${channel}/${event} failed: ${result.status} ${result.error}`);
  } catch (e) {
    console.warn(`[realtime] broadcast ${channel}/${event} threw`, e);
  } finally {
    await supabase.removeChannel(ch);
  }
}
