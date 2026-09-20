import { adminApi } from "@/features/admin/server/api";
import { moderateUser } from "@/features/admin/server/users";
import type { AdminAction } from "@/features/admin/types";
import { AdminError } from "@/lib/admin-auth/config";

function isAction(value: string): value is AdminAction {
  return ["suspend", "unsuspend", "revoke-sessions", "analytics-exclusion"].includes(value);
}
export async function POST(request: Request, context: { params: Promise<{ userId: string; action: string }> }) {
  return adminApi(request, async (admin) => {
    const { userId, action } = await context.params;
    if (!isAction(action)) throw new AdminError(404, "없는 관리 작업입니다");
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("reason" in body) || typeof body.reason !== "string") throw new AdminError(400, "조치 사유를 입력해 주세요");
    const excluded = "excluded" in body && typeof body.excluded === "boolean" ? body.excluded : undefined;
    return moderateUser(admin.id, userId, action, { reason: body.reason, excluded });
  }, true);
}
