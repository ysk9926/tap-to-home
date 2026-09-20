import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { ScreenTitle } from "@/components/paper";
import { PrivacyBody } from "@/features/legal/privacy-body";

export const metadata: Metadata = { title: "개인정보 처리방침 · Tap to Home" };

export default function MyPrivacyPage() {
  return (
    <div className="flex flex-1 flex-col pb-4">
      <BackLink href="/my" label="마이페이지" />
      <ScreenTitle>개인정보 처리방침</ScreenTitle>
      <PrivacyBody />
    </div>
  );
}
