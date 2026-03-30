import Image from "next/image";
import Link from "next/link";
import { Crown } from "lucide-react";
import { BALANCE_ROLES } from "@/lib/balance-teams";
import { roleLabel } from "@/lib/lanes";
import type { role_type } from "@/generated/prisma/enums";

export type TeamMemberVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: role_type;
  ratingUsed: number;
};

export type TeamCardVM = {
  id: string;
  name: string;
  totalRating: number;
  captainUserId: string | null;
  members: TeamMemberVM[];
};

function roleOrder(r: role_type): number {
  const i = BALANCE_ROLES.indexOf(r);
  return i === -1 ? 99 : i;
}

export function TournamentTeamsList({ teams }: { teams: TeamCardVM[] }) {
  if (teams.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
        Times ({teams.length})
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {teams.map((t) => {
          const sorted = [...t.members].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
          return (
            <li
              key={t.id}
              className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">
                    <Link
                      href={`/teams/${t.id}`}
                      className="hover:text-tm-cyan hover:underline"
                    >
                      {t.name}
                    </Link>
                  </h3>
                  <p className="text-xs text-tm-muted">
                    Soma dos ratings:{" "}
                    <span className="text-tm-cyan">{t.totalRating.toFixed(1)}</span>
                  </p>
                  <Link
                    href={`/teams/${t.id}`}
                    className="mt-2 inline-block text-xs font-medium text-tm-purple hover:underline"
                  >
                    Página do time →
                  </Link>
                </div>
              </div>
              <ul className="space-y-2">
                {sorted.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10">
                        {m.avatarUrl ? (
                          <Image
                            src={m.avatarUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black/40 text-[10px] font-bold text-tm-cyan">
                            {m.nickname.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-white">{m.nickname}</span>
                      {t.captainUserId === m.userId ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                          title="Capitão"
                        >
                          <Crown className="h-3 w-3" />
                          Capitão
                        </span>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <span className="text-tm-muted">{roleLabel(m.role)}</span>
                      <span className="ml-2 text-tm-cyan">{m.ratingUsed.toFixed(0)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
