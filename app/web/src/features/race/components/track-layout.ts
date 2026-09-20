import { STAGES, stageIndexOf } from "../stages";

// Positions inside RaceScene's 108×72 viewBox: seat, doorway, crossing and bed.
const OCCUPANT_CENTERS = [28, 37, 37, 62, 37, 54];

/** Fixed scenery occupies equally spaced slots, leaving room at both ends. */
export function landmarkPositionOf(index: number, size: number): string {
  const fraction = index / (STAGES.length - 1);
  return `calc(${fraction * 100}% - ${fraction * size * 1.5}px)`;
}

/** Interpolate the person between chair/doorway coordinates, never the buildings. */
export function trackPositionOf(count: number, size: number): string {
  const index = stageIndexOf(count);
  const next = Math.min(index + 1, STAGES.length - 1);
  const fraction = next === index ? 0 : Math.max(0,
    (count - STAGES[index].threshold) / (STAGES[next].threshold - STAGES[index].threshold),
  );
  const progress = (index + fraction) / (STAGES.length - 1);
  const center = OCCUPANT_CENTERS[index] + (OCCUPANT_CENTERS[next] - OCCUPANT_CENTERS[index]) * fraction;
  return `calc(${progress * 100}% + ${center * size / 72 - progress * size * 1.5}px)`;
}
