import { UsersView } from "@/features/admin/components/users-view";
import { requirePageAdmin } from "@/lib/admin-auth/current-admin";

export default async function AdminUsersPage() {
  const admin = await requirePageAdmin();
  return <UsersView adminId={admin.id} />;
}
