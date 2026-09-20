import { adminApi } from "@/features/admin/server/api";
import { getAdminUserDetail } from "@/features/admin/server/users";
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  return adminApi(request, async () => getAdminUserDetail((await context.params).userId));
}
