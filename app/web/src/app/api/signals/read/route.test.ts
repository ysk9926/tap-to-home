import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  markSignalsRead: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/features/signal/server/signals", () => ({ markSignalsRead: mocks.markSignalsRead }));

import { POST } from "./route";

const USER = { id: "receiver-1", name: "수신자", username: "receiver" };

function request(body: string): Request {
  return new Request("http://localhost/api/signals/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(USER);
  mocks.markSignalsRead.mockResolvedValue(undefined);
});

describe("POST /api/signals/read", () => {
  it("returns 204 and scopes the receipt to the authenticated receiver", async () => {
    const response = await POST(request(JSON.stringify({ ids: ["signal-1", "signal-1", "signal-2"] })));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(mocks.markSignalsRead).toHaveBeenCalledWith(USER.id, ["signal-1", "signal-1", "signal-2"]);
  });

  it("returns 401 without writing when unauthenticated", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request(JSON.stringify({ ids: ["signal-1"] })));

    expect(response.status).toBe(401);
    expect(mocks.markSignalsRead).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{"],
    ["missing ids", JSON.stringify({})],
    ["empty ids", JSON.stringify({ ids: [] })],
    ["more than 50 ids", JSON.stringify({ ids: Array.from({ length: 51 }, (_, index) => `signal-${index}`) })],
    ["non-string id", JSON.stringify({ ids: [42] })],
    ["blank id", JSON.stringify({ ids: ["   "] })],
    ["overlong id", JSON.stringify({ ids: ["x".repeat(129)] })],
  ])("returns 400 for %s", async (_case, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mocks.markSignalsRead).not.toHaveBeenCalled();
  });
});
