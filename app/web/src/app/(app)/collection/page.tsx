import { Note, ScreenTitle } from "@/components/paper";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function CollectionPage() {
  const user = await requirePageUser();
  return (
    <>
      <ScreenTitle>퇴근 도감</ScreenTitle>
      <Note>{user.name} · 도감 준비 중</Note>
    </>
  );
}
