import { describe, expect, it } from "vitest";
import { authErrorMessage, NETWORK_ERROR } from "./auth-error";

describe("authErrorMessage", () => {
  it("puts credential failures under the password field", () => {
    expect(authErrorMessage({ code: "INVALID_USERNAME_OR_PASSWORD", status: 401 })).toEqual({
      field: "password",
      message: "아이디 또는 비밀번호가 틀렸어요",
    });
  });

  it("says the same thing whether the username exists or the password is wrong", () => {
    // 플러그인이 두 경우를 구분해 주지 않는다. 구분하면 계정 존재가 새어 나간다
    const missingUser = authErrorMessage({ code: "INVALID_USERNAME_OR_PASSWORD", status: 401 });
    const wrongPassword = authErrorMessage({ code: "USER_NOT_FOUND", status: 401 });
    expect(missingUser).toEqual(wrongPassword);
  });

  it("points format errors at the field that caused them", () => {
    expect(authErrorMessage({ code: "USERNAME_TOO_SHORT", status: 422 }).field).toBe("username");
    expect(authErrorMessage({ code: "INVALID_USERNAME", status: 422 }).field).toBe("username");
    expect(authErrorMessage({ code: "PASSWORD_TOO_SHORT", status: 422 }).field).toBe("password");
  });

  it("names the taken username on signup", () => {
    expect(authErrorMessage({ code: "USERNAME_IS_ALREADY_TAKEN", status: 422 })).toEqual({
      field: "username",
      message: "이미 쓰는 아이디예요",
    });
  });

  it("separates rate limiting from a server fault", () => {
    expect(authErrorMessage({ status: 429 }).message).toBe("잠시 뒤에 다시 시도해 주세요");
    expect(authErrorMessage({ status: 503 }).message).toBe("잠시 후 다시 시도해 주세요");
  });

  it("reads a missing response as a connection problem", () => {
    expect(authErrorMessage({ status: 0 })).toEqual(NETWORK_ERROR);
  });

  it("falls back to a retry message for codes it does not know", () => {
    expect(authErrorMessage({ code: "SOMETHING_NEW", status: 400 })).toEqual({
      field: null,
      message: "잠시 후 다시 시도해 주세요",
    });
    expect(authErrorMessage(null).field).toBeNull();
  });
});
