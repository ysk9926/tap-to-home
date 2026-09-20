/**
 * 탈퇴하지 않은 유저만 고르는 조건 (소프트 삭제, docs/data-model.md).
 *
 * 필터를 여기 한 곳에 모으는 이유: 유저를 조회하는 곳마다 `deletedAt: null` 을 손으로
 * 적으면 한 군데만 빠뜨려도 탈퇴 유저가 랭킹·검색에 유령으로 남고, 그걸 아무도 눈치채지
 * 못한다. 이 상수를 쓰는 지점은 네 곳이며 각각 회귀 테스트가 붙어 있다:
 * 친구 검색·친구 목록(listFriendIds)·레이스 랭킹·세션 검증.
 */
export const ACTIVE_USER = { deletedAt: null } as const;
