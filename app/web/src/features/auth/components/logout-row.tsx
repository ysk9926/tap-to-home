"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkerButton } from "@/components/marker-button";
import { MarkerDialog } from "@/components/marker-dialog";
import { useLiveSync } from "@/features/realtime/live-sync-context";
import { signOut } from "@/lib/auth/client";

/**
 * 마이페이지의 로그아웃 줄 (F0-5). 연타 중 잘못 눌러 레이스가 끊기지 않도록
 * 확인 다이얼로그를 한 번 거친다.
 */
export function LogoutRow() {
  const router = useRouter();
  const { endSession } = useLiveSync();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setPending(true);
    try {
      await signOut();
      await endSession();
      setAsking(false);
      // replace: 뒤로 가기로 앱 화면에 돌아오지 못하게 한다.
      // refresh 로 서버 레이아웃이 세션을 다시 읽게 해 캐시된 화면도 비운다
      router.replace("/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex w-full items-center justify-between border-b-[1.5px] border-dashed border-pencil-soft py-3.5 text-left font-ui text-xl font-bold"
      >
        로그아웃
        <span className="font-note text-lg text-pencil-soft">→</span>
      </button>

      <MarkerDialog
        open={asking}
        onClose={() => setAsking(false)}
        title="로그아웃할까요?"
        actions={
          <>
            <MarkerButton variant="ghost" size="sm" onClick={() => setAsking(false)}>
              그만두기
            </MarkerButton>
            <MarkerButton size="sm" onClick={handleLogout} disabled={pending}>
              {pending ? "나가는 중…" : "로그아웃"}
            </MarkerButton>
          </>
        }
      >
        <p className="font-note text-lg text-pencil">
          다시 들어오려면 아이디와 비밀번호가 필요해요.
        </p>
        {error && (
          <p role="alert" className="mt-2 font-note text-base text-margin">
            {error}
          </p>
        )}
      </MarkerDialog>
    </>
  );
}
