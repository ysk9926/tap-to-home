"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { settleToday } from "./server/settle";

/** /today 의 "오늘 정산" 버튼 */
export async function settleTodayAction(): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");
  await settleToday(user);
  revalidatePath("/today");
  revalidatePath("/collection");
  revalidatePath("/");
  redirect("/today");
}
