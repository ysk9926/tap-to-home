import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Paper } from "@/components/paper";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await headers());
  if (user) redirect("/");

  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-8">{children}</div>
    </Paper>
  );
}
