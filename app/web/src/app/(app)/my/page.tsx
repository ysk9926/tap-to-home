import Link from "next/link";
import type { ReactNode } from "react";
import { Note, ScreenTitle } from "@/components/paper";
import { LogoutRow } from "@/features/auth/components/logout-row";
import { getCollection } from "@/features/titles/server/collection";
import { requirePageUser } from "@/lib/auth/current-user";

function MenuRow({ href, label, right }: { href: string; label: string; right?: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-b-[1.5px] border-dashed border-pencil-soft py-3.5 font-ui text-xl font-bold"
    >
      {label}
      <span className="tabular font-note text-lg text-pencil-soft">{right ?? "→"}</span>
    </Link>
  );
}

export default async function MyPage() {
  const user = await requirePageUser();
  const collection = await getCollection(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>마이페이지</ScreenTitle>
      <Note>@{user.username} · {user.name}</Note>

      <div className="mt-5">
        <MenuRow href="/my/profile" label="내 정보" />
        <MenuRow
          href="/my/collection"
          label="퇴근 도감"
          right={`${collection.earned} / ${collection.total}`}
        />
        <MenuRow href="/my/terms" label="이용약관" />
        <MenuRow href="/my/privacy" label="개인정보 처리방침" />
        <LogoutRow />
      </div>

      <div className="mt-auto pt-10 text-center">
        <Link href="/my/delete" className="font-note text-base text-pencil-soft underline underline-offset-4">
          계정 탈퇴
        </Link>
      </div>
    </div>
  );
}
