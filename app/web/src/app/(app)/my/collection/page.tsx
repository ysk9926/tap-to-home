import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { getCollection } from "@/features/titles/server/collection";
import { requirePageUser } from "@/lib/auth/current-user";

export default async function CollectionPage() {
  const user = await requirePageUser();
  const collection = await getCollection(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-baseline justify-between">
        <ScreenTitle>퇴근 도감</ScreenTitle>
        <span className="tabular text-2xl font-bold">
          {collection.earned}
          <small className="text-[15px] font-normal text-pencil-soft"> / {collection.total}</small>
        </span>
      </div>
      <Note>못 얻은 칭호는 힌트만 보여요</Note>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {collection.items.map(({ def, earned, isNew }) => (
          <TitleBadge
            key={def.id}
            name={def.name}
            pose={def.pose}
            locked={!earned}
            hint={earned ? undefined : def.hint}
            isNew={isNew}
          />
        ))}
      </div>
    </div>
  );
}
