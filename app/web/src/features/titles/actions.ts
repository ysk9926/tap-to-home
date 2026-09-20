"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

/**
 * 진입 다이얼로그를 닫을 때 안 본 결과를 전부 본 것으로 표시한다.
 * 한 건만 보여주고 나머지를 남겨 두면 다음 진입에서 또 뜬다.
 */
export async function markResultsSeenAction(): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  await prisma.dailyResult.updateMany({
    where: { seenAt: null, dailyRun: { userId: user.id } },
    data: { seenAt: new Date() },
  });
}
