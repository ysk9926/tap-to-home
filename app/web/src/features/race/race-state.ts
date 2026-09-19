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
