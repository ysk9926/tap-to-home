import { Note, ScreenTitle } from "@/components/paper";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function FriendsPage() {
  const user = await requirePageUser();
  return (
    <>
      <ScreenTitle>친구</ScreenTitle>
      <Note>{user.name} · 친구 화면 준비 중</Note>
    </>
  );
}
