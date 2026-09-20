import { adminApi } from "@/features/admin/server/api";
import { listAdminAudit } from "@/features/admin/server/users";
export async function GET(request: Request) {
  return adminApi(request, () => listAdminAudit(new URL(request.url).searchParams));
}
