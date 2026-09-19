"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "레이스" },
  { href: "/ranking", label: "랭킹" },
  { href: "/friends", label: "친구" },
  { href: "/today", label: "오늘" },
  { href: "/collection", label: "도감" },
] as const;

/** 하단 탭. 활성 탭은 매직 밑줄. 형광펜은 화면 본문에 양보한다 */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-marker bg-paper"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-14 max-w-[420px] grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="grid place-items-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "px-1.5 py-1 font-ui text-lg leading-none",
                  active
                    ? "border-b-[3px] border-marker font-bold text-ink"
                    : "text-pencil-soft",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
