import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { MatchMvpSection, type MatchMvpPlayerVM } from "@/components/match-mvp-section";
import { MatchPrintUrlForm } from "@/components/match-print-url-form";
import { MatchResultForm, MatchScheduleForm } from "@/components/match-detail-forms";
import { match_status } from "@/generated/prisma/client";
import { role_type } from "@/generated/prisma/enums";
import { BALANCE_ROLES } from "@/lib/balance-teams";
import { roundLabel } from "@/lib/bracket-utils";
import { getPrisma } from "@/lib/prisma";
import { getTournamentViewerContext } from "@/lib/tournament-access";

function roleOrder(r: role_type): number {
  const i = BALANCE_ROLES.findIndex((x) => x === r);
  return i === -1 ? 99 : i;
}

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; matchId: string }> };

export default async function MatchDetailPage({ params }: Props) {
  const { id, matchId } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const ctx = await getTournamentViewerContext(prisma, id, session.user.id);
  if (!ctx) notFound();

  const enrollment = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: { tournament_id: id, user_id: session.user.id },
    },
  });
  const canVoteMvp = !!enrollment;

  const match = await prisma.matches.findFirst({
    where: { id: matchId, tournament_id: id },
    include: {
      teams_matches_team_a_idToteams: { select: { id: true, name: true } },
      teams_matches_team_b_idToteams: { select: { id: true, name: true } },
      teams_matches_winner_team_idToteams: { select: { id: true, name: true } },
    },
  });

  if (!match) notFound();

  const maxAgg = await prisma.matches.aggregate({
    where: { tournament_id: id },
    _max: { round: true },
  });
  const totalRounds = Math.max(maxAgg._max.round ?? 1, 1);
  const label = roundLabel(match.round, totalRounds);

  const a = match.teams_matches_team_a_idToteams;
  const b = match.teams_matches_team_b_idToteams;
  const w = match.teams_matches_winner_team_idToteams;
  const finished = match.status === match_status.FINISHED;
  const canResult = ctx.isOrganizer && a && b && !finished;

  const teamAId = match.team_a_id;
  const teamBId = match.team_b_id;

  let mvpPlayers: MatchMvpPlayerVM[] = [];
  let voteCountByUserId: Record<string, number> = {};
  let mvpWinnerUserIds: string[] = [];
  let myVoteUserId: string | null = null;

  if (teamAId && teamBId) {
    const members = await prisma.team_members.findMany({
      where: { team_id: { in: [teamAId, teamBId] } },
      include: {
        users: { include: { profiles: true } },
        teams: { select: { name: true } },
      },
    });

    const sortedMembers = [...members].sort((x, y) => {
      const tx = x.team_id === teamAId ? 0 : 1;
      const ty = y.team_id === teamAId ? 0 : 1;
      if (tx !== ty) return tx - ty;
      return roleOrder(x.assigned_role) - roleOrder(y.assigned_role);
    });

    mvpPlayers = sortedMembers.map((m) => ({
      userId: m.user_id,
      nickname: m.users.profiles?.nickname ?? "Jogador",
      avatarUrl: m.users.profiles?.avatar_url ?? null,
      role: m.assigned_role,
      teamName: m.teams.name,
    }));

    const votes = await prisma.match_mvp_votes.groupBy({
      by: ["voted_user_id"],
      where: { match_id: match.id },
      _count: { _all: true },
    });

    voteCountByUserId = Object.fromEntries(votes.map((v) => [v.voted_user_id, v._count._all]));

    const totalMvpVotes = votes.reduce((s, v) => s + v._count._all, 0);
    if (totalMvpVotes > 0 && votes.length > 0) {
      const max = Math.max(...votes.map((v) => v._count._all));
      mvpWinnerUserIds = votes.filter((v) => v._count._all === max).map((v) => v.voted_user_id);
    }

    const myVote = await prisma.match_mvp_votes.findUnique({
      where: {
        match_id_voter_user_id: {
          match_id: match.id,
          voter_user_id: session.user.id,
        },
      },
    });
    myVoteUserId = myVote?.voted_user_id ?? null;
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/tournaments/${id}/chaveamento`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Chaveamento
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-tm-purple">{label}</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Detalhes da partida</h1>
        <p className="mt-1 text-sm text-tm-muted">{ctx.tournament.name}</p>
        <p className="mt-2 text-xs text-tm-muted">
          Estado:{" "}
          <span className={finished ? "text-emerald-300" : "text-amber-200"}>
            {finished ? "FINISHED (concluída)" : "PENDING (aguarda resultado)"}
          </span>
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase text-tm-muted">Time A</p>
            <p className="mt-1 text-lg font-semibold text-white">{a?.name ?? "A definir"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase text-tm-muted">Time B</p>
            <p className="mt-1 text-lg font-semibold text-white">{b?.name ?? "A definir"}</p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-6 text-sm">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-tm-cyan" />
          <div>
            <p className="text-xs uppercase text-tm-muted">Quando</p>
            {match.match_date ? (
              <p className="text-white">
                {match.match_date.toLocaleString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            ) : (
              <p className="text-tm-muted">Ainda não agendada</p>
            )}
          </div>
        </div>

        {finished ? (
          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-xs uppercase text-tm-muted">Resultado</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {match.score_a ?? 0} — {match.score_b ?? 0}
            </p>
            <p className="mt-2 text-sm text-tm-cyan">Vencedor: {w?.name ?? "—"}</p>
          </div>
        ) : null}
      </div>

      {mvpPlayers.length > 0 ? (
        <MatchMvpSection
          matchId={match.id}
          tournamentId={id}
          matchFinished={finished}
          players={mvpPlayers}
          voteCountByUserId={voteCountByUserId}
          mvpWinnerUserIds={mvpWinnerUserIds}
          myVoteUserId={myVoteUserId}
          canVoteMvp={canVoteMvp}
        />
      ) : null}

      {ctx.isOrganizer ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Organizador — print da partida
          </h2>
          <div className="mt-4">
            <MatchPrintUrlForm
              matchId={match.id}
              tournamentId={id}
              initialUrl={match.match_image_url}
            />
          </div>
        </section>
      ) : null}

      {ctx.isOrganizer ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Organizador — horário
          </h2>
          <div className="mt-4">
            <MatchScheduleForm
              matchId={match.id}
              tournamentId={id}
              matchDateIso={match.match_date?.toISOString() ?? null}
            />
          </div>
        </section>
      ) : null}

      {canResult ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Organizador — resultado
          </h2>
          <div className="mt-4">
            <MatchResultForm
              matchId={match.id}
              tournamentId={id}
              teamAId={a!.id}
              teamBId={b!.id}
              teamAName={a!.name}
              teamBName={b!.name}
              finished={false}
            />
          </div>
        </section>
      ) : null}

      {ctx.isOrganizer && finished ? (
        <p className="text-sm text-tm-muted">
          Para alterar o resultado seria necessário suporte adicional no sistema; por agora o registo é
          definitivo.
        </p>
      ) : null}
    </div>
  );
}
