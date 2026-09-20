import { Note, ScreenTitle } from "@/components/paper";
import { RecordRow } from "@/features/titles/components/record-row";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { listRecords } from "@/features/titles/server/record-list";
import { getTodaySummary } from "@/features/titles/server/today-summary";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function RecordsPage() {
  const user = await requirePageUser();
  const [today, records] = await Promise.all([getTodaySummary(user), listRecords(user.id)]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>퇴근 기록</ScreenTitle>
      <Note>{kstDateLabel(today.date)} · 진행 중</Note>

      <TodayResultCard summary={today} />
      <Note className="mt-2 text-center">자정이 지나면 자동으로 정산돼요</Note>

      <h2 className="mt-7 font-ui text-xl font-bold">지난 기록</h2>
      {records.length === 0 ? (
        <Note className="mt-2">아직 정산된 날이 없어요. 오늘 밤이 첫 기록이 돼요</Note>
      ) : (
        <div className="mt-1">
          {records.map((record) => (
            <RecordRow key={record.date} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
