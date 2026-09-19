import { FriendsScreen } from "@/features/friends/components/friends-screen";
import { listFriends } from "@/features/friends/server/friends";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function FriendsPage() {
  const user = await requirePageUser();
  const friends = await listFriends(user.id);
  return <FriendsScreen me={{ name: user.name, username: user.username }} initialFriends={friends} />;
}
