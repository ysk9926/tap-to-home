import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { AdminIdentity } from "@/features/admin/types";
import { getAdminAuth } from "./server";

export async function getAdmin(requestHeaders: Headers): Promise<AdminIdentity | null> {
  if (!(requestHeaders.get("cookie") ?? "").includes("tth-admin.session_token=")) return null;
  const session = await getAdminAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const master = await prisma.adminUser.findFirst({
    where: { id: session.user.id, disabledAt: null }, select: { id: true, name: true, username: true },
  });
  if (!master || master.id !== "master") return null;
  return { ...master, username: master.username ?? "" };
}

export async function requirePageAdmin(): Promise<AdminIdentity> {
  const master = await getAdmin(await headers());
  if (!master) redirect("/admin/login");
  return master;
}
