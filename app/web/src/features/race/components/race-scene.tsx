import { Stickman } from "@/components/stickman";
import { cn } from "@/lib/cn";
import { poseOf, stageOf, type StageKey } from "../stages";

export const SCENE_CAPTIONS: Record<StageKey, [string, string]> = {
  seat: ["책상 앞에 앉아 있어요", "책상에서 일어나 달려요"],
  elevator: ["엘리베이터 안에서 기다려요", "엘리베이터 문을 열고 달려 나와요"],
  lobby: ["로비 안에서 기다려요", "로비 문을 열고 달려 나와요"],
  crosswalk: ["신호를 기다려요", "보행 신호에 맞춰 달려요"],
  subway: ["지하철을 타고 있어요", "지하철 문을 열고 달려 나와요"],
  home: ["집에서 침대에 누워 쉬어요", "집에서 침대에 누워 쉬어요"],
};

/** A fixed landmark. Its waiting occupant can leave while the furniture stays put. */
export function RaceScene({ count, running = false, occupied = true, frame = 0, size = 64, className }: {
  count: number;
  running?: boolean;
  occupied?: boolean;
  frame?: 0 | 1;
  /** Scene height in pixels. */
  size?: number;
  className?: string;
}) {
  const stage = stageOf(count).key;
  const moving = running && stage !== "home";
  const doorway = stage === "elevator" || stage === "lobby" || stage === "subway";
  const x = moving ? 67 : stage === "seat" || stage === "crosswalk" ? 8 : 17;
  /*
   * 레일에서는 size 36(메인) / 24(랭킹) 로 줄어든다. viewBox 가 72 이므로 선과 글자가
   * 그대로면 1px 아래로 뭉개진다. 굵기를 축소율만큼 되돌리고, 작을 때는 읽히지 않는
   * 잔디테일(창문·바닥 무늬·신호 글자)을 빼서 실루엣과 상태만 남긴다.
   */
  const detailed = size >= 64;
  const stroke = 1.7 * Math.max(1, 44 / size);
  return (
    <svg
      width={size * 1.5} height={size} viewBox="0 0 108 72"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      className={cn("block overflow-visible text-pencil", className)}
      role={occupied ? "img" : undefined}
      aria-label={occupied ? SCENE_CAPTIONS[stage][moving ? 1 : 0] : undefined}
      aria-hidden={!occupied}
      data-stage={stage}
    >
      {stage === "seat" && <g transform="translate(8 10)">
        <path d="M7 22 Q5.5 28 8 35 M8 35 Q16 36 25 35 M16 36 L16 52 M8 55 Q16 50 23 55" />
        <path d="M30 31 Q45 30 62 31 M34 32 L33 56 M59 32 L60 56" />
        <path d="M43 13 Q51 12 60 13 L60 25 Q51 26 43 25 Z M51 26 L51 30" />
        {detailed && <path d="M46 17 L56 17 M46 21 L52 21" opacity=".45" />}
      </g>}
      {doorway && <>
        {stage === "lobby" ? <>
          <path d="M3 3 Q35 0 70 3 L68 10 L5 10 Z M9 11 L8 67 M65 11 L66 67" />
          {detailed && <path d="M16 3 L15 9 M34 2 L34 9 M52 3 L53 9" opacity=".5" />}
        </> : stage === "subway" ? <>
          <path d="M2 67 V16 Q2 5 15 5 H64 Q74 5 74 16 V67 Z" />
          {detailed && <path d="M6 23 H13 V42 H6 Z M62 23 H69 V42 H62 Z M26 65 H53" />}
          <path d="M21 10 H57" />
        </> : <>
          <path d="M13 67 V10 Q37 8 61 10 V67" />
          <path d="M29 5 L35 0 L41 5 M67 34 v2" />
        </>}
        <path d="M18 67 V12 H56 V67" fill="var(--paper-2)" />
      </>}
      {stage === "crosswalk" && <>
        <path d="M48 67 V32 M39 4 H57 V32 H39 Z" fill="var(--paper)" />
        {/* 작을 때는 불이 곧 상태다. 반지름을 키워 36px 에서도 어느 쪽이 켜졌는지 보이게 한다. */}
        <circle cx="48" cy="12" r={detailed ? 4 : 5} fill={moving ? "none" : "currentColor"} />
        <circle cx="48" cy="24" r={detailed ? 4 : 5} fill={moving ? "currentColor" : "none"} />
        {detailed && <>
          <text x="64" y="12" stroke="none" fill="currentColor" className="font-note" fontSize="13">{moving ? "건너기" : "대기"}</text>
          <path d="M64 67 l4 -7 h6 l-4 7 Z M76 67 l4 -7 h6 l-4 7 Z M88 67 l4 -7 h6 l-4 7 Z" opacity=".5" />
        </>}
      </>}
      {stage === "home" && <path d="M2 28 L54 3 L106 28 M9 26 V67 H101 V26" />}
      {doorway && <g strokeOpacity={moving ? 1 : .45}>
        {/* Draw glass behind the occupant so its seams cannot cover the face. */}
        <path d={moving ? "M18 12 H37 V67 H18 Z M22 21 H32 V36 H22 Z" : "M37 12 H18 V67 H37 M22 21 H32 V36 H22 Z"}
          fill="var(--paper)" fillOpacity={moving ? 1 : .18}
          transform={moving ? "translate(-13 0)" : undefined}
          className="transition-transform duration-150 ease-[steps(2)]" />
        <path d={moving ? "M37 12 H56 V67 H37 Z M42 21 H52 V36 H42 Z" : "M37 12 H56 V67 H37 M42 21 H52 V36 H42 Z"}
          fill="var(--paper)" fillOpacity={moving ? 1 : .18}
          transform={moving ? "translate(13 0)" : undefined}
          className="transition-transform duration-150 ease-[steps(2)]" />
      </g>}
      {occupied && (stage === "home" ? <>
        <path d="M14 55.5 H84 M14 42 V65 M84 43 V65 M14 61 H84" />
        <g transform="translate(9 28)"><Stickman pose="lie" size={58} frame={frame} /></g>
        {detailed && <>
          <text x="37" y="30" stroke="none" fill="currentColor" className="font-note" fontSize="10">z</text>
          <text x="45" y="22" stroke="none" fill="currentColor" className="font-note" fontSize="8">z</text>
        </>}
      </> : <g
        transform={`translate(${x} 10)`}
        className={moving ? "transition-transform duration-150 ease-[steps(2)]" : undefined}
      >
        {moving ? <>
          <g className="race-run-first"><Stickman pose="run" size={60} frame={0} /></g>
          <g className="race-run-second"><Stickman pose="run" size={60} frame={1} /></g>
        </> : <Stickman pose={poseOf(count)} size={60} frame={frame} />}
      </g>)}
    </svg>
  );
}
