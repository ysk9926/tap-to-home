import "server-only";
import { prisma } from "@/lib/db";
import { kstDate } from "@/lib/kst";
import { TITLES, type TitleDef } from "../catalog";

export type CollectionItem = { def: TitleDef; earned: boolean; isNew: boolean };

/** 도감 (F3-2). 카탈로그 순서대로, 오늘 처음 얻은 것은 isNew */
export async function getCollection(userId: string, now: Date = new Date()) {
  const today = kstDate(now);
  const rows = await prisma.userTitle.findMany({
    where: { userId },
    select: { titleId: true, firstEarnedOn: true },
  });
  const byId = new Map(rows.map((r) => [r.titleId, r]));
  const items: CollectionItem[] = TITLES.map((def) => {
    const row = byId.get(def.id);
    return { def, earned: Boolean(row), isNew: row?.firstEarnedOn.getTime() === today.getTime() };
  });
  return { earned: items.filter((i) => i.earned).length, total: TITLES.length, items };
}
