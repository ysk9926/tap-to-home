import "server-only";
import type { AdminIdentity } from "../types";
import { getAdmin } from "@/lib/admin-auth/current-admin";
import { AdminError, assertAdminOrigin } from "@/lib/admin-auth/config";

export async function adminApi(
  request: Request,
  action: (admin: AdminIdentity) => Promise<unknown>,
  mutation = false,
): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const admin = await getAdmin(request.headers);
    if (!admin) throw new AdminError(401, "관리자 로그인이 필요합니다");
    if (mutation) assertAdminOrigin(request);
    return Response.json(await action(admin), { headers });
  } catch (error) {
    if (error instanceof AdminError) return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 400, headers });
    console.error("[admin] request failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요" }, { status: 500, headers });
  }
}
