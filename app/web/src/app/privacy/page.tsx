import type { Metadata } from "next";
import Link from "next/link";
import { Paper, ScreenTitle } from "@/components/paper";
import { PrivacyBody } from "@/features/legal/privacy-body";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · Tap to Home",
  description: "Tap to Home 이 수집하는 개인정보와 처리 방식",
};

export default function PrivacyPage() {
  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-16">
        <ScreenTitle>개인정보 처리방침</ScreenTitle>
        <PrivacyBody />

        <div className="mt-10">
          <Link
            href="/"
            className="font-note text-lg underline decoration-dotted underline-offset-4"
          >
            ← 돌아가기
          </Link>
        </div>
      </div>
    </Paper>
  );
}
