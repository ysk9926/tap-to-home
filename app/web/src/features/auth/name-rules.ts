/**
 * 닉네임 규칙과 서버 액션의 반환 타입.
 *
 * `actions.ts` 에 두지 않는 이유: `"use server"` 파일은 async 함수만 export 할 수 있다.
 * 상수나 타입을 하나라도 내보내면 Turbopack 이 그 모듈의 export 를 전부 버려서,
 * 액션을 import 하던 클라이언트 컴포넌트가 통째로 깨진다 (tsc 는 이걸 잡지 못하고
 * `next build` 에서만 드러난다).
 */

export const NAME_MIN = 1;
export const NAME_MAX = 12;

export type ActionState = { error?: string; ok?: boolean };
