import { RankingScreen } from "@/features/race/components/ranking-screen";
import { getRaceToday } from "@/features/race/server/today";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RankingPage() {
  const user = await requirePageUser();
  const initial = await getRaceToday(user);
  return <RankingScreen initial={initial} />;
}
