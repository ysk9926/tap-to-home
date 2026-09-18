import type { ReactNode } from "react";
import { Paper } from "@/components/paper";

/** dev/ui 전용. 372px 폰 프레임 안에 화면 예시를 넣어 본다 */
export function PhoneFrame({
  caption,
  time = "9:41",
  children,
}: {
  caption: ReactNode;
  time?: string;
  children: ReactNode;
}) {
  return (
    <article className="w-[372px] shrink-0">
      <p className="mb-2 ml-1.5 font-note text-xl text-pencil">{caption}</p>
      <div className="mk relative h-[760px] overflow-hidden rounded-[34px_30px_36px_32px/32px_36px_30px_34px] shadow-paper before:border-[3.5px]">
        <Paper className="absolute inset-0" style={{ backgroundPositionY: 6 }}>
          <div className="flex justify-between px-6 pt-3 text-[15px] font-bold">
            <span>{time}</span>
            <span>ıll ▮</span>
          </div>
          <div className="absolute left-1/2 top-2 h-[22px] w-[110px] -translate-x-1/2 rounded-b-2xl border-[3px] border-t-0 border-marker" />
          <div className="absolute inset-x-0 bottom-0 top-11 flex flex-col px-[22px] pb-[22px] pl-[46px] pt-3">
            {children}
          </div>
        </Paper>
      </div>
    </article>
  );
}
