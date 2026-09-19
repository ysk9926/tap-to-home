import { FriendsScreen } from "@/features/friends/components/friends-screen";
import { getFriendsState } from "@/features/friends/server/friends-state";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function FriendsPage() {
  const user = await requirePageUser();
  const friends = await getFriendsState(user.id);
  return <FriendsScreen me={{ name: user.name, username: user.username }} initialFriends={friends} />;
}
