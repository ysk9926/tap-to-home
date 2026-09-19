import type { ReactNode } from "react";
import { Paper } from "@/components/paper";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Paper className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[420px] px-3 pt-10 pb-8">{children}</div>
    </Paper>
  );
}
