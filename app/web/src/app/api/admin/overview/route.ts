import { adminApi } from "@/features/admin/server/api";
import { getDashboard } from "@/features/admin/server/metrics";
export async function GET(request: Request) {
  return adminApi(request, () => getDashboard(new URL(request.url).searchParams));
}
