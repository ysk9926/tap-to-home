import { UserDetailView } from "@/features/admin/components/user-detail-view";
import { requirePageAdmin } from "@/lib/admin-auth/current-admin";

export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[userId]">) {
  const [admin, { userId }] = await Promise.all([requirePageAdmin(), params]);
  return <UserDetailView adminId={admin.id} userId={userId} />;
}
