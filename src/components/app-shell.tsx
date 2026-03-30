import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { SessionProfile } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

type Props = {
  session: SessionProfile;
  children: React.ReactNode;
};

export function AppShell({ session, children }: Props) {
  const nickname = session.profile?.nickname ?? "Jogador";
  const avatarUrl = session.profile?.avatar_url;
  const initials = nickname.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090d1d]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-tm-purple/20 text-xs font-bold text-tm-cyan">
              TM
            </span>
            <span className="text-base font-semibold tracking-tight text-white transition group-hover:text-tm-cyan">
              TourneyMaster
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-3">
            <span className="truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-tm-muted sm:text-sm">
              {nickname}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-tm-purple/90 transition hover:bg-white/10"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5" />
            </button>
            <Link
              href="/profile"
              className="relative h-9 w-9 overflow-hidden rounded-full border border-white/15 ring-2 ring-tm-purple/35 transition hover:ring-tm-cyan/50 sm:h-10 sm:w-10"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={nickname}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-tm-surface text-xs font-semibold text-tm-cyan sm:text-sm">
                  {initials}
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex-1 w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>

      <BottomNav />
    </div>
  );
}
