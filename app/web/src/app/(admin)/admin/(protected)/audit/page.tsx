import { AuditView } from "@/features/admin/components/audit-view";
import { requirePageAdmin } from "@/lib/admin-auth/current-admin";

export default async function AdminAuditPage() {
  const admin = await requirePageAdmin();
  return <AuditView adminId={admin.id} />;
}
