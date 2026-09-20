import { BackLink } from "@/components/back-link";
import { Note, ScreenTitle } from "@/components/paper";
import { NotifySwitches } from "@/features/auth/components/notify-switches";
import { PasswordForm } from "@/features/auth/components/password-form";
import { ProfileForm } from "@/features/auth/components/profile-form";
import { getProfile } from "@/features/auth/server/profile";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function ProfilePage() {
  const user = await requirePageUser();
  const profile = await getProfile(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <BackLink href="/my" label="마이페이지" />
      <ScreenTitle>내 정보</ScreenTitle>
      <Note>아이디는 친구가 나를 찾는 열쇠라 바꿀 수 없어요</Note>

      <p className="mt-4 font-ui text-xl font-bold">
        아이디 <span className="font-note font-normal text-pencil">@{profile.username}</span>
      </p>

      <ProfileForm name={profile.name} />

      <h2 className="mt-8 font-ui text-xl font-bold">비밀번호</h2>
      <PasswordForm />

      <h2 className="mt-8 font-ui text-xl font-bold">알림</h2>
      <NotifySwitches
        notifySignal={profile.notifySignal}
        notifySettlement={profile.notifySettlement}
      />
    </div>
  );
}
