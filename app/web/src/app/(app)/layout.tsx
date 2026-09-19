import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Paper } from "@/components/paper";
import { FriendRequestWatcher } from "@/features/friends/components/friend-request-watcher";
import { getFriendsState } from "@/features/friends/server/friends-state";
import { realtimeEnabled } from "@/features/realtime/server/enabled";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  // 받은 요청은 어느 화면에서든 다이얼로그로 떠야 해서 레이아웃에서 한 번 읽는다 (F0-3)
  const friends = await getFriendsState(user.id);

  return (
    <Paper className="flex min-h-full flex-1 flex-col pb-20">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-3 pt-4">{children}</div>
      <BottomNav />
      <FriendRequestWatcher myId={user.id} initial={friends} realtimeEnabled={realtimeEnabled()} />
    </Paper>
  );
}
