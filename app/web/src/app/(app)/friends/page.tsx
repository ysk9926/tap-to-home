import { FriendsScreen } from "@/features/friends/components/friends-screen";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function FriendsPage() {
  const user = await requirePageUser();
  return <FriendsScreen me={{ name: user.name, username: user.username }} />;
}
