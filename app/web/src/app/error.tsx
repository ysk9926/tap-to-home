"use client";

import { useEffect } from "react";
import { MarkerButton } from "@/components/marker-button";
import { Note, Paper, ScreenTitle } from "@/components/paper";

export default function AppError({ error, retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] route rendering failed", error);
  }, [error]);

  return (
    <Paper className="flex min-h-dvh flex-col bg-paper">
      <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-5 py-12">
        <p aria-hidden="true" className="font-note text-6xl leading-none text-margin">!</p>
        <ScreenTitle className="mt-3">페이지가 잠시 멈췄어요</ScreenTitle>
        <Note className="mt-2">연결을 다시 확인하고 같은 자리에서 이어갈게요.</Note>
        <MarkerButton className="mt-7 self-start" onClick={retry}>
          다시 불러오기
        </MarkerButton>
      </main>
    </Paper>
  );
}
