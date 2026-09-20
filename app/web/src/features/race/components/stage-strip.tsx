import { RaceTrack } from "./race-track";

export function StageStrip({ count, frame = 0, name = "나", className }: {
  count: number;
  frame?: 0 | 1;
  name?: string;
  className?: string;
}) {
  return <RaceTrack count={count} frame={frame} name={name} className={className} />;
}
