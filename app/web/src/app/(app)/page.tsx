import { RaceScreen } from "@/features/race/components/race-screen";
import { getRaceToday } from "@/features/race/server/today";
import { realtimeEnabled } from "@/features/realtime/server/enabled";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function RacePage() {
  const user = await requirePageUser();
  const initial = await getRaceToday(user);
  return <RaceScreen initial={initial} realtimeEnabled={realtimeEnabled()} />;
}
