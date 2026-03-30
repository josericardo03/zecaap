import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Crown } from "lucide-react";
import Image from "next/image";
import { getSessionProfile } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { BALANCE_ROLES } from "@/lib/balance-teams";
import { roleLabel } from "@/lib/lanes";
import { TeamCaptainTransferForm } from "@/components/team-captain-transfer-form";
import { TeamSettingsForm } from "@/components/team-settings-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ teamId: string }> };

function roleOrder(r: string): number {
  const i = BALANCE_ROLES.findIndex((x) => x === r);
  return i === -1 ? 99 : i;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export default async function TeamPage({ params }: Props) {
  const { teamId } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    include: {
      tournaments: true,
      team_members: {
        include: {
          users: { include: { profiles: true } },
        },
      },
    },
  });

  if (!team) notFound();

  const memberIds = new Set(team.team_members.map((m) => m.user_id));
  const isMember = memberIds.has(session.user.id);
  const isOrganizer = team.tournaments.created_by === session.user.id;
  if (!isMember && !isOrganizer) notFound();

  const isCaptain = team.captain_user_id === session.user.id;

  const sortedMembers = [...team.team_members].sort(
    (a, b) => roleOrder(a.assigned_role) - roleOrder(b.assigned_role)
  );

  const captainOptions = team.team_members.map((m) => ({
    userId: m.user_id,
    nickname: m.users.profiles?.nickname ?? "Jogador",
  }));

  return (
    <div className="space-y-8">
      <Link
        href={`/tournaments/${team.tournament_id}`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao torneio
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {team.logo_url ? (
            <Image src={team.logo_url} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-tm-cyan">
              {team.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-tm-muted">
            {isMember ? "Meu time" : "Time"}
          </p>
          <h1 className="text-2xl font-bold text-white">{team.name}</h1>
          <Link
            href={`/tournaments/${team.tournament_id}`}
            className="mt-1 text-sm text-tm-cyan hover:underline"
          >
            {team.tournaments.name}
          </Link>
          {team.description ? (
            <p className="mt-3 text-sm text-tm-muted">{team.description}</p>
          ) : null}
        </div>
      </header>

      {isOrganizer ? (
        <TeamCaptainTransferForm
          teamId={team.id}
          currentCaptainId={team.captain_user_id}
          members={captainOptions}
        />
      ) : null}

      {isCaptain ? (
        <TeamSettingsForm
          teamId={team.id}
          initialName={team.name}
          initialDescription={team.description}
          initialLogoUrl={team.logo_url}
        />
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Elenco
        </h2>
        <ul className="space-y-3">
          {sortedMembers.map((m) => {
            const cap = team.captain_user_id === m.user_id;
            return (
              <li
                key={m.user_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-tm-surface/90 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10">
                    {m.users.profiles?.avatar_url ? (
                      <Image
                        src={m.users.profiles.avatar_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-black/40 text-xs font-bold text-tm-cyan">
                        {(m.users.profiles?.nickname ?? "J").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {m.users.profiles?.nickname ?? "Jogador"}
                    </p>
                    {cap ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                        <Crown className="h-3.5 w-3.5" />
                        Capitão
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <span className="text-tm-muted">{roleLabel(m.assigned_role)}</span>
                  <span className="ml-2 font-medium text-tm-cyan">{toNum(m.rating_used).toFixed(0)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
