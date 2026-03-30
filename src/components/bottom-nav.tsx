"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, User } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tournaments", label: "Torneios", icon: Trophy },
  { href: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/5 bg-[#0b0e1b]/95 px-2 py-2 backdrop-blur-md">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs transition ${
              active
                ? "bg-tm-purple/40 text-white"
                : "text-tm-muted hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
