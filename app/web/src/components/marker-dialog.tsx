"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  /** ESC·배경 클릭으로 닫을 때. 되돌릴 수 없는 확인 창이라면 취소와 같은 뜻이다 */
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 하단 버튼 줄 */
  actions: ReactNode;
  className?: string;
};

/**
 * 네이티브 `<dialog>` 기반 모달. showModal() 이 포커스 트랩·배경 비활성화·ESC 를 맡아
 * 직접 구현할 게 없다. 종이 톤은 MarkerBox 와 같은 `mk` 프레임을 쓴다.
 */
export function MarkerDialog({ open, onClose, title, children, actions, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // ESC 는 dialog 가 직접 닫으므로 상태를 되돌려 받아야 한다
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // 배경(::backdrop) 클릭 — dialog 자신이 이벤트 대상이면 바깥을 누른 것이다
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "mk shadow-paper m-auto w-[min(22rem,calc(100vw-2.5rem))] bg-paper p-5 text-ink",
        "backdrop:bg-ink/25",
        className,
      )}
    >
      <h2 className="font-ui text-2xl font-bold leading-tight text-balance">{title}</h2>
      <div className="mt-3">{children}</div>
      <div className="mt-5 flex justify-end gap-2">{actions}</div>
    </dialog>
  );
}
