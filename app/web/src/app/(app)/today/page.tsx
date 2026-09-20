import Link from "next/link";
import { Note, ScreenTitle } from "@/components/paper";
import { TitleBadge } from "@/components/title-badge";
import { TITLE_BY_ID } from "@/features/titles/catalog";
import { TodayResultCard } from "@/features/titles/components/today-result-card";
import { getTodaySummary } from "@/features/titles/server/today-summary";
import { requirePageUser } from "@/lib/auth/current-user";
import { kstDateLabel } from "@/lib/kst";

export default async function TodayPage() {
  const user = await requirePageUser();
  const summary = await getTodaySummary(user);
  const result = summary.result;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenTitle>{result ? "오늘도 수고했어요" : "오늘의 결과"}</ScreenTitle>
      <Note>
        {kstDateLabel(summary.date)} · {result ? "정산 완료" : "정산 전"}
      </Note>

      <TodayResultCard summary={summary} />

      {result ? (
        <>
          <div className="mt-4 flex items-baseline justify-between text-xl font-bold">
            <span>오늘 얻은 칭호</span>
            <span className="tabular">{result.titleIds.length}개</span>
          </div>
          {result.titleIds.length === 0 ? (
            <Note className="mt-2">오늘은 조건에 맞는 칭호가 없었어요</Note>
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
          <div className="mt-auto pt-6">
            <Link
              href="/my/collection"
              className="mk mk-pill block px-4 py-2.5 text-center font-ui text-xl font-bold text-ink"
            >
              도감 전체 보기
            </Link>
          </div>
        </>
      ) : (
        <Note className="mt-auto pt-6">자정에 자동으로 정산돼요.</Note>
      )}
    </div>
  );
}
