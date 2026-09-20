import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
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
        <BackLink href="/" label="돌아가기" />
        <ScreenTitle>개인정보 처리방침</ScreenTitle>
        <PrivacyBody />
      </div>
    </Paper>
  );
}
