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
  const x = moving ? 67 : stage === "seat" ? 8 : stage === "crosswalk" ? 42 : 23;
  return (
    <svg
      width={size * 1.5} height={size} viewBox="0 0 108 72"
      fill="none" stroke="currentColor" strokeWidth="1.7"
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
        <path d="M46 17 L56 17 M46 21 L52 21" opacity=".45" />
      </g>}
      {doorway && <>
        {stage === "lobby" ? <>
          <path d="M3 12 Q35 8 70 12 L68 19 L5 19 Z M9 20 L8 67 M65 20 L66 67" />
          <path d="M16 12 L15 18 M34 11 L34 18 M52 12 L53 18" opacity=".5" />
        </> : stage === "subway" ? <>
          <path d="M2 67 V16 Q2 5 15 5 H64 Q74 5 74 16 V67 Z" />
          <path d="M6 23 H13 V42 H6 Z M62 23 H69 V42 H62 Z M26 65 H53" />
        </> : <>
          <path d="M13 67 V15 Q37 13 61 15 V67" />
          <path d="M29 9 L35 3 L41 9 M67 34 v2" />
        </>}
        <path d="M18 67 V21 H56 V67" fill="var(--paper-2)" />
      </>}
      {stage === "crosswalk" && <>
        <path d="M17 66 V32 M8 4 H26 V32 H8 Z" fill="var(--paper)" />
        <circle cx="17" cy="12" r="4" fill={moving ? "none" : "currentColor"} />
        <circle cx="17" cy="24" r="4" fill={moving ? "currentColor" : "none"} />
        <text x="32" y="12" stroke="none" fill="currentColor" className="font-note" fontSize="13">{moving ? "건너기" : "대기"}</text>
        <path d="M32 72 l4 -7 h6 l-4 7 Z M44 72 l4 -7 h6 l-4 7 Z M56 72 l4 -7 h6 l-4 7 Z" opacity=".5" />
      </>}
      {stage === "home" && <path d="M2 28 L54 3 L106 28 M9 26 V67 H101 V26" />}
      {occupied && (stage === "home" ? <>
        <path d="M7 32 V66 M7 55 Q54 53 101 55 V66 M7 61 H101 M101 46 V60" />
        <path d="M10 49 Q18 44 29 49 L29 54 H10 Z" fill="var(--paper-2)" />
        <g transform="translate(9 28)"><Stickman pose="lie" size={58} /></g>
        <text x="64" y="23" stroke="none" fill="currentColor" className="font-note" fontSize="17">z z Z</text>
      </> : <g
        transform={`translate(${x} ${doorway && !moving ? 25 : 10})`}
        className="transition-transform duration-150 ease-[steps(2)]"
      >
        {moving ? <>
          <g className="race-run-first"><Stickman pose="run" size={60} frame={frame} /></g>
          <g className="race-run-second"><Stickman pose="run" size={60} frame={frame === 0 ? 1 : 0} /></g>
        </> : <Stickman pose={poseOf(count)} size={doorway ? 43 : 60} frame={frame} />}
      </g>)}
      {doorway && <>
        {/* Translucent doors keep the waiting passenger visible inside. */}
        <path d="M18 22 H37 V67 H18 Z M22 29 H32 V43 H22 Z"
          fill="var(--paper)" fillOpacity={moving ? 1 : .35}
          transform={moving ? "translate(-13 0)" : undefined}
          className="transition-transform duration-150 ease-[steps(2)]" />
        <path d="M37 22 H56 V67 H37 Z M42 29 H52 V43 H42 Z"
          fill="var(--paper)" fillOpacity={moving ? 1 : .35}
          transform={moving ? "translate(13 0)" : undefined}
          className="transition-transform duration-150 ease-[steps(2)]" />
      </>}
    </svg>
  );
}
