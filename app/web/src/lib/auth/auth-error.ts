/**
 * better-auth 가 돌려준 실패를 사용자가 읽을 문구로 옮긴다 (F0-1).
 *
 * 없는 아이디와 틀린 비밀번호는 일부러 같은 문구다. 플러그인이 두 경우 모두
 * INVALID_USERNAME_OR_PASSWORD 를 던지고, 없는 아이디일 때도 더미 해시를 한 번
 * 돌려 응답 시간까지 맞춘다. 구분하려면 "이 아이디 있나요" 를 답하는 엔드포인트가
 * 따로 있어야 하는데, 그건 아이디 검색(F0-2)과 합쳐져 계정을 훑는 통로가 된다.
 */

/** signIn/signUp 이 돌려주는 error 객체에서 우리가 보는 부분 */
export type AuthErrorLike = {
  code?: string;
  status?: number;
  message?: string;
};

/** 어느 입력칸 아래에 문구를 붙일지. null 이면 폼 전체 알림 */
export type AuthErrorField = "username" | "password" | null;

export type AuthErrorMessage = {
  field: AuthErrorField;
  message: string;
};

const CREDENTIALS: AuthErrorMessage = {
  field: "password",
  message: "아이디 또는 비밀번호가 틀렸어요",
};

const BY_CODE: Record<string, AuthErrorMessage> = {
  INVALID_USERNAME_OR_PASSWORD: CREDENTIALS,
  INVALID_EMAIL_OR_PASSWORD: CREDENTIALS,
  USER_NOT_FOUND: CREDENTIALS,
  USERNAME_IS_ALREADY_TAKEN: { field: "username", message: "이미 쓰는 아이디예요" },
  USERNAME_TOO_SHORT: { field: "username", message: "3자 이상이어야 해요" },
  USERNAME_TOO_LONG: { field: "username", message: "20자까지 쓸 수 있어요" },
  INVALID_USERNAME: { field: "username", message: "영문·숫자·_ 만 쓸 수 있어요" },
  INVALID_DISPLAY_USERNAME: { field: "username", message: "영문·숫자·_ 만 쓸 수 있어요" },
  PASSWORD_TOO_SHORT: { field: "password", message: "8자 이상이어야 해요" },
  PASSWORD_TOO_LONG: { field: "password", message: "비밀번호가 너무 길어요" },
};

/**
 * 네트워크가 끊기면 fetch 가 그냥 throw 한다 — 응답도 status 도 없다.
 * 폼의 catch 에서 이 값을 쓴다.
 */
export const NETWORK_ERROR: AuthErrorMessage = {
  field: null,
  message: "인터넷 연결을 확인해 주세요",
};

export function authErrorMessage(error: AuthErrorLike | null | undefined): AuthErrorMessage {
  if (!error) return { field: null, message: "잠시 후 다시 시도해 주세요" };

  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  const status = error.status ?? 0;
  if (status === 429) return { field: null, message: "잠시 뒤에 다시 시도해 주세요" };
  if (status >= 500) return { field: null, message: "잠시 후 다시 시도해 주세요" };
  // status 0 은 응답 자체가 없었다는 뜻이라 네트워크 문제로 본다
  if (status === 0) return NETWORK_ERROR;

  return { field: null, message: "잠시 후 다시 시도해 주세요" };
}
