import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActivityTracker } from "@/features/analytics/components/activity-tracker";
import { LiveSyncProvider } from "@/features/realtime/components/live-sync-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Paper } from "@/components/paper";
import { FriendRequestWatcher } from "@/features/friends/components/friend-request-watcher";
import { getFriendsState } from "@/features/friends/server/friends-state";
import { PushRegistrar } from "@/features/push/components/push-registrar";
import { realtimeEnabled } from "@/features/realtime/server/enabled";
import { SettlementWatcher } from "@/features/titles/components/settlement-watcher";
import { getUnseenResult } from "@/features/titles/server/unseen-result";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  // 받은 요청은 어느 화면에서든 다이얼로그로 떠야 해서 레이아웃에서 한 번 읽는다 (F0-3).
  // 자정 정산 결과도 같은 이유로 여기서 읽는다 — 푸시를 못 받는 경로의 전달 통로다.
  const [friends, unseen] = await Promise.all([getFriendsState(user.id), getUnseenResult(user.id)]);

  // h-dvh + overflow-hidden: 랭킹 화면(/ranking)이 내 레인을 고정하고 친구 목록만
  // 스크롤하려면 컨테이너 높이가 뷰포트로 묶여 있어야 한다. 그래서 문서 스크롤 대신
  // 아래 content wrapper 가 스크롤을 맡는다 — 긴 화면(도감·친구)은 여기서 스크롤되고,
  // 랭킹은 스스로 overflow-hidden 을 걸어 내부 목록만 움직인다.
  return (
    <LiveSyncProvider key={user.id} userId={user.id} initialFriends={friends} realtimeEnabled={realtimeEnabled()}>
      <Paper className="flex h-dvh flex-col overflow-hidden pb-14">
        <div className="mx-auto flex min-h-0 w-full max-w-[420px] flex-1 flex-col overflow-y-auto px-3 pb-6 pt-4">
          {children}
        </div>
        <BottomNav />
        <SettlementWatcher result={unseen} />
        <FriendRequestWatcher settlementPending={unseen !== null} />
        <PushRegistrar />
        <ActivityTracker userId={user.id} />
      </Paper>
    </LiveSyncProvider>
  );
}
