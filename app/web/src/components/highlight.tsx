import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** 형광펜. 한 화면에 한 군데만 칠한다 */
export function Highlight({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("hl", className)} {...props} />;
}
