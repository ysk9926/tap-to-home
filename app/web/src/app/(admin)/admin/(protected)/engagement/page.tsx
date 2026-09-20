import { DashboardView } from "@/features/admin/components/dashboard-view";
import { requirePageAdmin } from "@/lib/admin-auth/current-admin";

export default async function AdminEngagementPage() {
  const admin = await requirePageAdmin();
  return <DashboardView adminId={admin.id} mode="engagement" />;
}
