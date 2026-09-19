/**
 * better-auth 코어는 email 을 필수로 요구한다. 아이디 로그인만 쓰므로 아이디로 만든 자리표시 이메일을 넣는다.
 * 화면에는 절대 노출하지 않는다 (docs/decisions/0005).
 */
export const PLACEHOLDER_EMAIL_DOMAIN = "id.tap-to-home.local";

export function placeholderEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}
