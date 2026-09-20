import Link from "next/link";
import type { Metadata } from "next";
import { ScreenTitle } from "@/components/paper";
import { PrivacyBody } from "@/features/legal/privacy-body";

export const metadata: Metadata = { title: "개인정보 처리방침 · Tap to Home" };

export default function MyPrivacyPage() {
  return (
    <div className="flex flex-1 flex-col pb-4">
      <ScreenTitle>개인정보 처리방침</ScreenTitle>
      <PrivacyBody />
      <Link href="/my" className="mt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        마이페이지로
      </Link>
    </div>
  );
}
