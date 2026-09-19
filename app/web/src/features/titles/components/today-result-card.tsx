import { Highlight } from "@/components/highlight";
import { MarkerBox } from "@/components/marker-box";
import { Stickman } from "@/components/stickman";
import { TITLE_BY_ID } from "../catalog";
import type { TodaySummary } from "../server/today-summary";

/** 정산 카드. result 가 null 이면 정산 전 요약만 */
export function TodayResultCard({ summary }: { summary: TodaySummary }) {
  const primary = summary.result?.primaryTitleId ? TITLE_BY_ID[summary.result.primaryTitleId] : null;
  const peak = summary.peakHour === null ? "–" : `${String(summary.peakHour).padStart(2, "0")}:00 – ${String(summary.peakHour + 1).padStart(2, "0")}:00`;

  return (
    <MarkerBox className="mt-3 px-4 pb-3 pt-3.5 text-center">
      <div className="font-note text-lg text-pencil-soft">
        {summary.result ? "오늘의 대표 칭호" : "정산하면 칭호가 정해져요"}
      </div>
      <div className="my-1 text-[30px] font-bold leading-[1.1] text-balance">
        {primary ? (
          <Highlight className="px-1.5">{primary.name}</Highlight>
        ) : (
          <span className="text-pencil-soft">{summary.result ? "칭호 없음 · 내일 다시" : "?"}</span>
        )}
      </div>
      <div className="flex h-[84px] items-end justify-center">
        <Stickman pose={primary?.pose ?? "stand"} size={44} thick />
      </div>
      <dl className="mt-2.5 grid grid-cols-[1fr_auto] gap-y-0.5 text-left text-lg">
        <dt className="text-pencil">총 횟수</dt>
        <dd className="tabular text-right font-bold">{summary.total}번</dd>
        <dt className="text-pencil">첫 퇴근 욕구</dt>
        <dd className="tabular text-right font-bold">{summary.firstTapAt ?? "–"}</dd>
        <dt className="text-pencil">가장 많이 누른 시간</dt>
        <dd className="tabular text-right font-bold">{peak}</dd>
        <dt className="text-pencil">오늘 랭킹</dt>
        <dd className="tabular text-right font-bold">
          {summary.rank}위 / {summary.rankTotal}명
        </dd>
      </dl>
    </MarkerBox>
  );
}
