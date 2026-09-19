import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * REST 로 채널에 한 번 쏜다. 키가 없거나 실패해도 요청 자체는 성공시킨다 (폴링이 받쳐준다).
 * 반환값은 실제 전달 성공 여부 — 호출부가 "실시간으로 전달됐다"에 의존하는 후속 작업
 * (예: 신호 읽음 처리)을 할지 판단하는 데 쓴다.
 */
export async function broadcast(channel: string, event: string, payload: unknown): Promise<boolean> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  const supabase = getSupabaseAdmin();
  const ch = supabase.channel(channel);
  try {
    const result = await ch.httpSend(event, payload, { timeout: 2000 });
    if (!result.success) {
      console.warn(`[realtime] broadcast ${channel}/${event} failed: ${result.status} ${result.error}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[realtime] broadcast ${channel}/${event} threw`, e);
    return false;
  } finally {
    await supabase.removeChannel(ch);
  }
}
