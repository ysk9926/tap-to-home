import { Note, ScreenTitle } from "@/components/paper";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function TodayPage() {
  const user = await requirePageUser();
  return (
    <>
      <ScreenTitle>오늘의 결과</ScreenTitle>
      <Note>{user.name} · 정산 준비 중</Note>
    </>
  );
}
