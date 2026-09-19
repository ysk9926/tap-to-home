import "server-only";

/**
 * FCM HTTP v1 클라이언트 (ADR 0006).
 *
 * firebase-admin SDK 를 쓰지 않는다 — 서버리스 콜드 스타트에 불리하고, 우리가 쓰는 건
 * "토큰 하나에 알림 한 번 보내기" 뿐이다. 서비스 계정으로 JWT 를 만들어 OAuth 토큰으로
 * 바꾼 뒤 fetch 로 호출한다. 서명은 Web Crypto (Node 18+ / Edge 양쪽에서 동작).
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** 액세스 토큰 수명은 1시간. 만료 1분 전에 새로 받는다 */
const TOKEN_TTL_SEC = 3600;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

/** FCM 이 "이 토큰은 죽었다" 고 알려주는 응답. 호출부가 행을 지운다 */
export type SendOutcome = "ok" | "unregistered" | "failed";

let cachedAccount: ServiceAccount | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

function readServiceAccount(): ServiceAccount | null {
  if (cachedAccount) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as ServiceAccount).project_id !== "string" ||
      typeof (parsed as ServiceAccount).client_email !== "string" ||
      typeof (parsed as ServiceAccount).private_key !== "string"
    ) {
      console.warn("[push] FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields");
      return null;
    }
    cachedAccount = parsed as ServiceAccount;
    return cachedAccount;
  } catch {
    console.warn("[push] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

/** 푸시를 보낼 수 있는 설정이 갖춰졌는지. 없으면 조용히 건너뛴다 (Realtime 과 같은 방침) */
export function isPushConfigured(): boolean {
  return readServiceAccount() !== null;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

/** PEM(PKCS#8) → CryptoKey. 서비스 계정 private_key 는 \n 이 이스케이프돼 있을 수 있다 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function fetchAccessToken(account: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_TTL_SEC,
  };
  const unsigned = `${base64urlJson({ alg: "RS256", typ: "JWT" })}.${base64urlJson(claim)}`;

  let jwt: string;
  try {
    const key = await importPrivateKey(account.private_key);
    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    );
    jwt = `${unsigned}.${base64url(sig)}`;
  } catch (e) {
    console.warn("[push] failed to sign service account JWT", e);
    return null;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.warn(`[push] token exchange failed: ${res.status} ${await res.text()}`);
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? TOKEN_TTL_SEC) * 1000,
    };
    return cachedToken.value;
  } catch (e) {
    console.warn("[push] token exchange threw", e);
    return null;
  }
}

async function getAccessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.value;
  }
  return fetchAccessToken(account);
}

export type PushMessage = {
  title: string;
  body: string;
  /** 앱이 열릴 때 어디로 보낼지. 웹뷰 셸이라 지금은 경로 문자열 하나면 충분하다 */
  path?: string;
};

/**
 * 토큰 하나에 알림 한 번. 실패해도 throw 하지 않는다 — 신호 저장은 이미 끝났고,
 * 푸시는 "가면 좋은" 부가 경로다. 죽은 토큰이면 "unregistered" 를 돌려주어 호출부가 지운다.
 */
export async function sendToToken(token: string, message: PushMessage): Promise<SendOutcome> {
  const account = readServiceAccount();
  if (!account) return "failed";

  const accessToken = await getAccessToken(account);
  if (!accessToken) return "failed";

  const payload = {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: message.path ? { path: message.path } : undefined,
      apns: {
        payload: {
          aps: {
            sound: "default",
            // 웹뷰 셸이라 배지 관리를 하지 않는다. 숫자를 올리면 지울 주체가 없다
            "content-available": 1,
          },
        },
      },
      android: {
        priority: "high",
        notification: { sound: "default" },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) return "ok";

    const text = await res.text();
    // 404 UNREGISTERED / 400 INVALID_ARGUMENT(토큰 형식) → 다시 쓸 수 없는 토큰
    if (res.status === 404 || text.includes("UNREGISTERED") || text.includes("InvalidRegistration")) {
      return "unregistered";
    }
    console.warn(`[push] send failed: ${res.status} ${text}`);
    return "failed";
  } catch (e) {
    console.warn("[push] send threw", e);
    return "failed";
  }
}

/** 테스트에서 모듈 캐시를 비운다 */
export function resetPushCacheForTest(): void {
  cachedAccount = null;
  cachedToken = null;
}
