"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";

export const NAME_MIN = 1;
export const NAME_MAX = 12;

export type ActionState = { error?: string; ok?: boolean };

/** 닉네임 변경. 아이디는 친구 검색 키라 바꿀 수 없다 */
export async function updateNameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { error: `닉네임은 ${NAME_MIN}~${NAME_MAX}자로 적어 주세요` };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/my");
  revalidatePath("/my/profile");
  return { ok: true };
}

/** 알림 스위치. 끄면 서버가 푸시 발송 전에 거른다 */
export async function updateNotifyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifySignal: formData.get("notifySignal") === "on",
      notifySettlement: formData.get("notifySettlement") === "on",
    },
  });
  revalidatePath("/my/profile");
}
