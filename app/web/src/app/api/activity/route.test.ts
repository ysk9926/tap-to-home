import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  recordActivity: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/features/analytics/server/activity", () => ({ recordActivity: mocks.recordActivity }));

import { POST } from "./route";

function request(origin = "https://tap.example") {
  return new Request("https://tap.example/api/activity", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ userId: "fabricated", activityDate: "1999-01-01" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "authenticated", name: "나", username: "me" });
  mocks.recordActivity.mockResolvedValue(true);
});

describe("POST /api/activity", () => {
  it("records only the authenticated same-origin user", async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(mocks.recordActivity).toHaveBeenCalledWith("authenticated");
  });

  it("rejects cross-origin requests before recording", async () => {
    const response = await POST(request("https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });

  it("rejects a POST without an Origin header", async () => {
    const response = await POST(new Request("https://tap.example/api/activity", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });

  it("rejects requests without an authenticated ordinary member", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });
});
