import { stageIndexOf } from "./stages";

/** GET /api/race/today 응답이자 클라이언트 캐시 형태 */
export type Racer = {
  userId: string;
  name: string;
  username: string;
  tapCount: number;
  stage: number;
  isMe: boolean;
};

export type RaceToday = {
  /** KST "YYYY-MM-DD" */
  date: string;
  me: Racer;
  /** 랭킹순 (나 포함) */
  racers: Racer[];
  /** 오늘 정산됨 → 탭 불가 */
  settled: boolean;
};

export function sortRacers(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => b.tapCount - a.tapCount || a.name.localeCompare(b.name, "ko"));
}

/** 한 명의 횟수를 바꾼 새 상태. 낙관적 업데이트와 실시간 이벤트가 같이 쓴다 */
export function withRacerCount(data: RaceToday, userId: string, tapCount: number): RaceToday {
  const patch = (r: Racer): Racer =>
    r.userId === userId ? { ...r, tapCount, stage: stageIndexOf(tapCount) } : r;
  return {
    ...data,
    me: patch(data.me),
    racers: sortRacers(data.racers.map(patch)),
  };
}

/** 새 날짜·정산은 권위 있는 서버 값, 같은 날의 늦은 조회는 더 최신 카운트를 유지한다. */
export function mergeRaceSnapshot(current: RaceToday | undefined, fresh: RaceToday): RaceToday {
  if (!current || current.date < fresh.date) return fresh;
  if (current.date > fresh.date || (current.settled && !fresh.settled)) return current;
  if (fresh.settled) return fresh;
  const counts = new Map(current.racers.map((racer) => [racer.userId, racer.tapCount]));
  counts.set(current.me.userId, current.me.tapCount);
  const keepNewer = (racer: Racer): Racer => {
    const count = Math.max(racer.tapCount, counts.get(racer.userId) ?? 0);
    return count === racer.tapCount ? racer : { ...racer, tapCount: count, stage: stageIndexOf(count) };
  };
  return { ...fresh, me: keepNewer(fresh.me), racers: sortRacers(fresh.racers.map(keepNewer)) };
}

export function selectRaceInitial(current: RaceToday, initial: RaceToday): RaceToday {
  return initial.date > current.date || (initial.date === current.date && initial.settled && !current.settled)
    ? initial : current;
}
