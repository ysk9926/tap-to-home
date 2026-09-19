import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isPushConfigured, resetPushCacheForTest, sendToToken } from "./fcm";

/** 테스트마다 새로 만든다. 저장소에 키를 남기지 않기 위해서다 */
const TEST_PRIVATE_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

function serviceAccountJson(): string {
  return JSON.stringify({
    project_id: "tap-to-home",
    client_email: "sa@tap-to-home.iam.gserviceaccount.com",
    private_key: TEST_PRIVATE_KEY,
  });
}

const ORIGINAL_ENV = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

beforeEach(() => {
  resetPushCacheForTest();
  vi.restoreAllMocks();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = ORIGINAL_ENV;
  resetPushCacheForTest();
});

describe("isPushConfigured", () => {
  it("is false when the env var is missing", () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    expect(isPushConfigured()).toBe(false);
  });

  it("is false when the JSON is malformed", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{not json";
    expect(isPushConfigured()).toBe(false);
  });

  it("is false when required fields are missing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: "p" });
    expect(isPushConfigured()).toBe(false);
  });

  it("is true for a complete service account", () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson();
    expect(isPushConfigured()).toBe(true);
  });
});

describe("sendToToken", () => {
  it("fails without configuration instead of throwing", async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    await expect(sendToToken("t", { title: "a", body: "b" })).resolves.toBe("failed");
  });

  it("reports a dead token as unregistered so the caller can drop it", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson();
    // 토큰 교환은 성공한 것으로, 발송은 404 로 흉내낸다
    vi.spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
      }
      return new Response("UNREGISTERED", { status: 404 });
    }) as typeof fetch);

    await expect(sendToToken("dead", { title: "a", body: "b" })).resolves.toBe("unregistered");
  });

  it("returns ok on a successful send", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson();
    vi.spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ name: "projects/tap-to-home/messages/1" }), { status: 200 });
    }) as typeof fetch);

    await expect(sendToToken("live", { title: "a", body: "b" })).resolves.toBe("ok");
  });

  it("does not throw when the network fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(sendToToken("t", { title: "a", body: "b" })).resolves.toBe("failed");
  });
});
