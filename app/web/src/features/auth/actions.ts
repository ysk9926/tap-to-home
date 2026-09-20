"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { softDeleteAccount } from "./server/delete-account";
import { NAME_MAX, NAME_MIN, type ActionState } from "./name-rules";

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

/**
 * 계정 탈퇴. 오조작을 막기 위해 자기 아이디를 정확히 입력해야 한다.
 * 성공하면 세션이 사라지므로 이후 요청은 /login 으로 튕긴다.
 */
export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/login");

  const typed = String(formData.get("confirmUsername") ?? "").trim().toLowerCase();
  if (typed !== user.username.toLowerCase()) {
    return { error: "아이디가 맞지 않아요" };
  }

  await softDeleteAccount(user.id);
  redirect("/login");
}
