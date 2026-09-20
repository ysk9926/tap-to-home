import "server-only";
import { prisma } from "@/lib/db";

export type Profile = {
  username: string;
  name: string;
  notifySignal: boolean;
  notifySettlement: boolean;
};

export async function getProfile(userId: string): Promise<Profile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, name: true, notifySignal: true, notifySettlement: true },
  });
  return { ...user, username: user.username ?? "" };
}
