import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { DeleteAccountForm } from "@/features/auth/components/delete-account-form";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function DeleteAccountPage() {
  const user = await requirePageUser();

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>계정 탈퇴</ScreenTitle>
      <Note>되돌릴 수 없어요</Note>

      <ul className="mt-5 space-y-2 font-note text-lg leading-relaxed text-pencil">
        <li>· 친구 목록과 랭킹에서 사라져요</li>
        <li>· 지금까지의 퇴근 기록과 도감을 볼 수 없어요</li>
        <li>· 알림이 더 이상 오지 않아요</li>
        <li>· @{user.username} 로는 다시 가입할 수 없어요</li>
      </ul>

      <DeleteAccountForm username={user.username} />

      <Link href="/my" className="mt-auto pt-8 text-center font-note text-lg text-pencil-soft underline underline-offset-4">
        그만두기
      </Link>
    </div>
  );
}
