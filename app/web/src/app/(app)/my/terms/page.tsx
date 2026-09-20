import Link from "next/link";
import type { Metadata } from "next";
import { ScreenTitle } from "@/components/paper";
import { TermsBody } from "@/features/legal/terms-body";

export const metadata: Metadata = { title: "이용약관 · Tap to Home" };

export default function MyTermsPage() {
  return (
    <div className="flex flex-1 flex-col pb-4">
      <ScreenTitle>이용약관</ScreenTitle>
      <TermsBody />
      <Link href="/my" className="mt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        마이페이지로
      </Link>
    </div>
  );
}
