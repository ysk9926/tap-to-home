import { Note, ScreenTitle } from "@/components/paper";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RacePage() {
  const user = await requirePageUser();
  return (
    <>
      <ScreenTitle>오늘 퇴근하고 싶은 횟수</ScreenTitle>
      <Note>{user.name} · 레이스 준비 중</Note>
    </>
  );
}
