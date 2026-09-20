import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { requirePageAdmin } from "@/lib/admin-auth/current-admin";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePageAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
