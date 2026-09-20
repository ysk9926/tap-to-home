import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { ScreenTitle } from "@/components/paper";
import { TermsBody } from "@/features/legal/terms-body";

export const metadata: Metadata = { title: "이용약관 · Tap to Home" };

export default function MyTermsPage() {
  return (
    <div className="flex flex-1 flex-col pb-4">
      <BackLink href="/my" label="마이페이지" />
      <ScreenTitle>이용약관</ScreenTitle>
      <TermsBody />
    </div>
  );
}
