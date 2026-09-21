import { RaceScreen } from "@/features/race/components/race-screen";
import { getProfile } from "@/features/auth/server/profile";
import { getRaceToday } from "@/features/race/server/today";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RacePage() {
  const user = await requirePageUser();
  const [initial, profile] = await Promise.all([getRaceToday(user), getProfile(user.id)]);
  return <RaceScreen initial={initial} showTopFriendRails={profile.showTopFriendRails} />;
}
