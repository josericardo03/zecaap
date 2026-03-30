import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { draft_state, team_formation_mode } from "@/generated/prisma/client";
import { roleLabel } from "@/lib/lanes";
import { getPrisma } from "@/lib/prisma";
import { getTournamentViewerContext } from "@/lib/tournament-access";
import { CaptainDraftPickForm } from "@/components/captain-draft-pick-form";
import { DraftTimeoutWatcher } from "@/components/draft-timeout-watcher";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TournamentDraftPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const ctx = await getTournamentViewerContext(prisma, id, session.user.id);
  if (!ctx) notFound();

  const tournament = await prisma.tournaments.findUnique({
    where: { id },
    include: {
      teams: {
        include: {
          team_members: {
            include: { users: { include: { profiles: true } } },
            orderBy: { created_at: "asc" },
          },
        },
        orderBy: { created_at: "asc" },
      },
      draft_picks: {
        include: {
          captain: { include: { profiles: true } },
          picked: { include: { profiles: true } },
        },
        orderBy: { pick_index: "asc" },
      },
      tournament_players: {
        include: { users: { include: { profiles: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!tournament) notFound();
  if (tournament.team_formation_mode !== team_formation_mode.CAPTAIN_DRAFT) {
    notFound();
  }

  const picksDone = await prisma.draft_picks.count({ where: { tournament_id: id } });
  const teamCount = tournament.draft_captain_order.length;
  const totalNeeded = teamCount > 0 ? teamCount * 4 : 0;

  let currentCaptainId: string | null = null;
  let round = 0;
  if (tournament.draft_state === draft_state.IN_PROGRESS && teamCount > 0 && picksDone < totalNeeded) {
    round = Math.floor(picksDone / teamCount) + 1;
    const pos = picksDone % teamCount;
    currentCaptainId =
      round % 2 === 1
        ? tournament.draft_captain_order[pos]
        : tournament.draft_captain_order[teamCount - 1 - pos];
  }

  const assigned = new Set(
    tournament.teams.flatMap((t) => t.team_members.map((m) => m.user_id))
  );
  const available = tournament.tournament_players
    .filter((p) => !assigned.has(p.user_id))
    .map((p) => ({
      userId: p.user_id,
      nickname: p.users.profiles?.nickname ?? "Jogador",
    }));

  const canPick = tournament.draft_state === draft_state.IN_PROGRESS && currentCaptainId === session.user.id;
  const currentCaptainName =
    tournament.tournament_players.find((p) => p.user_id === currentCaptainId)?.users.profiles?.nickname ??
    (currentCaptainId ? "Capitão" : null);
  const turnEndsAt =
    tournament.draft_turn_started_at &&
    tournament.draft_state === draft_state.IN_PROGRESS
      ? new Date(tournament.draft_turn_started_at.getTime() + tournament.draft_pick_timeout_sec * 1000)
      : null;
  const leftSec = turnEndsAt ? Math.max(0, Math.floor((turnEndsAt.getTime() - Date.now()) / 1000)) : null;

  return (
    <div className="space-y-8">
      <DraftTimeoutWatcher tournamentId={id} enabled={tournament.draft_state === draft_state.IN_PROGRESS} />
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Torneio
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Draft por capitães</h1>
        <p className="mt-1 text-sm text-tm-muted">{ctx.tournament.name}</p>
        <p className="mt-2 text-xs text-tm-muted">
          Snake: rodada ímpar na ordem original, rodada par em ordem invertida.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
        <p className="text-sm text-tm-muted">
          Estado do draft:{" "}
          <span className="font-semibold text-white">{tournament.draft_state}</span>
          {tournament.draft_state === draft_state.IN_PROGRESS ? (
            <span>
              {" "}
              · Pick {picksDone + 1}/{totalNeeded}
              {round > 0 ? ` · Rodada ${round}` : ""}
            </span>
          ) : null}
        </p>
        {currentCaptainName ? (
          <p className="mt-1 text-sm text-tm-cyan">
            Capitão da vez: <strong>{currentCaptainName}</strong>
          </p>
        ) : null}
        {leftSec !== null ? (
          <p className="mt-1 text-xs text-tm-muted">
            Tempo restante do pick: {leftSec}s · Política: {tournament.draft_timeout_policy}
          </p>
        ) : null}
      </section>

      {canPick ? (
        <section className="rounded-2xl border border-tm-cyan/30 bg-tm-surface/90 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Sua escolha
          </h2>
          <CaptainDraftPickForm tournamentId={id} available={available} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Jogadores disponíveis ({available.length})
        </h2>
        {available.length === 0 ? (
          <p className="text-sm text-tm-muted">Pool vazio.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {available.map((p) => (
              <li key={p.userId} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                {p.nickname}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Times no draft ({tournament.teams.length})
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {tournament.teams.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
              <p className="font-semibold text-white">{t.name}</p>
              <ul className="mt-3 space-y-2">
                {t.team_members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{m.users.profiles?.nickname ?? "Jogador"}</span>
                    <span className="text-tm-muted">{roleLabel(m.assigned_role)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">Histórico de picks</h2>
        {tournament.draft_picks.length === 0 ? (
          <p className="text-sm text-tm-muted">Sem picks ainda.</p>
        ) : (
          <ul className="space-y-2">
            {tournament.draft_picks.map((p) => (
              <li key={p.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="text-tm-muted">#{p.pick_index} · R{p.round}</span>{" "}
                <span className="text-white">
                  {p.captain.profiles?.nickname ?? "Capitão"}
                  {p.skipped
                    ? " passou a vez"
                    : ` escolheu ${p.picked?.profiles?.nickname ?? "Jogador"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

