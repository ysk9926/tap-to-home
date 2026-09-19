"use client";

import { SignalToast } from "@/components/signal-toast";
import type { ToastItem } from "@/features/signal/hooks/use-signal-toasts";
import { signalMessage } from "@/features/signal/messages";

/** 하단 탭 위에 떠 있는 신호 토스트. 최근 것이 아래 */
export function SignalToastLayer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-[420px] flex-col gap-2 px-3">
      {toasts.slice(-3).map((t) => {
        const m = signalMessage(t.senderName, t.level);
        return (
          <SignalToast key={t.id} level={t.level} meta={`${m.meta} · 방금`} className="pointer-events-auto shadow-paper">
            <b>{m.name}</b>
            {m.suffix}
          </SignalToast>
        );
      })}
    </div>
  );
}
