import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { TITLE_BY_ID } from "@/features/titles/catalog";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { getRecordDetail } from "@/features/titles/server/record-list";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function RecordDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const user = await requirePageUser();
  const summary = await getRecordDetail(user, date);
  if (!summary?.result) notFound();

  const { result } = summary;

  return (
    <div className="flex flex-1 flex-col">
      <BackLink href="/records" label="퇴근 기록" />
      <ScreenTitle>그날의 기록</ScreenTitle>
      <Note>{kstDateLabel(summary.date)} · 정산 완료</Note>

      <TodayResultCard summary={summary} />

      <div className="mt-4 flex items-baseline justify-between text-xl font-bold">
        <span>이날 얻은 칭호</span>
        <span className="tabular">{result.titleIds.length}개</span>
      </div>
      {result.titleIds.length === 0 ? (
        <Note className="mt-2">이날은 조건에 맞는 칭호가 없었어요</Note>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {result.titleIds.map((id) => (
            <TitleBadge
              key={id}
              name={TITLE_BY_ID[id].name}
              pose={TITLE_BY_ID[id].pose}
              isNew={result.newTitleIds.includes(id)}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Link
          href="/my/collection"
          className="mk mk-pill block px-4 py-2.5 text-center font-ui text-xl font-bold text-ink"
        >
          도감 전체 보기
        </Link>
        <Link href="/records" className="text-center font-note text-lg text-pencil-soft underline underline-offset-4">
          기록 목록으로
        </Link>
      </div>
    </div>
  );
}
