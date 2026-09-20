import { TITLE_BY_ID, type TitleId } from "./catalog";

/**
 * 자정 정산 알림 문구. 인앱 다이얼로그와 같은 사실만 말한다 —
 * 대표 칭호가 있으면 칭호를, 없으면 횟수를 앞세운다.
 */
export function settlementMessage(
  primaryTitleId: TitleId | null,
  total: number,
): { title: string; body: string } {
  const count = total.toLocaleString("ko-KR");
  if (primaryTitleId) {
    return {
      title: "어제의 칭호가 나왔어요",
      body: `어제 당신은 '${TITLE_BY_ID[primaryTitleId].name}'`,
    };
  }
  return {
    title: "어제의 기록이 정리됐어요",
    body: `어제 ${count}번 퇴근하고 싶었어요`,
  };
}
