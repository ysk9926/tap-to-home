import { adminApi } from "@/features/admin/server/api";
import { listAdminUsers } from "@/features/admin/server/users";
export async function GET(request: Request) {
  return adminApi(request, () => listAdminUsers(new URL(request.url).searchParams));
}
