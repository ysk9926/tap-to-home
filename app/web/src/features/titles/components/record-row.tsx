import Link from "next/link";
import { Stickman } from "@/components/stickman";
import { TITLE_BY_ID } from "../catalog";
import type { RecordSummary } from "../server/record-list";

/** 기록 목록의 한 줄. 누르면 그날 상세로 */
export function RecordRow({ record }: { record: RecordSummary }) {
  const primary = record.primaryTitleId ? TITLE_BY_ID[record.primaryTitleId] : null;
  const [, month, day] = record.date.split("-");

  return (
    <Link
      href={`/records/${record.date}`}
      className="flex items-center gap-3 border-b-[1.5px] border-dashed border-pencil-soft py-3"
    >
      <Stickman pose={primary?.pose ?? "stand"} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="font-ui text-xl font-bold">
            {Number(month)}월 {Number(day)}일
          </span>
          {record.hasNew && (
            <span className="font-ui text-sm font-bold text-margin">NEW</span>
          )}
        </span>
        <span className="block truncate font-note text-lg text-pencil">
          {primary ? primary.name : "칭호 없음"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular block font-ui text-xl font-bold">
          {record.total.toLocaleString("ko-KR")}번
        </span>
        <span className="tabular block font-note text-base text-pencil-soft">
          {record.rank}위 / {record.rankTotal}명
        </span>
      </span>
    </Link>
  );
}
