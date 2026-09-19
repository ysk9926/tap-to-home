import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Paper } from "@/components/paper";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  return (
    <Paper className="flex min-h-full flex-1 flex-col pb-20">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-3 pt-4">{children}</div>
      <BottomNav />
    </Paper>
  );
}
