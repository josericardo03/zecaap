import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar, Hash, ScrollText, Star, Trophy, Users } from "lucide-react";
import {
  saveTournamentRegistration,
} from "@/app/actions/tournament-registration";
import { leaveTournamentBlockedReason } from "@/lib/tournament-leave-eligibility";
import { getSessionProfile } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { StartCaptainDraftForm } from "@/components/start-captain-draft-form";
import { DeleteTournamentForm } from "@/components/delete-tournament-form";
import { GenerateBracketForm } from "@/components/generate-bracket-form";
import { GenerateTeamsForm } from "@/components/generate-teams-form";
import { RegisteredPlayersList } from "@/components/registered-players-list";
import type { RegisteredPlayerVM } from "@/components/registered-players-list";
import { LeaveTournamentForm } from "@/components/leave-tournament-form";
import { TournamentRegistrationForm } from "@/components/tournament-registration-form";
import { TournamentTeamsList, type TeamCardVM } from "@/components/tournament-teams-list";
import { draft_state, team_formation_mode, tournament_status } from "@/generated/prisma/client";
import { isPowerOfTwoTeamCount } from "@/lib/bracket-utils";
import { buildLanePeerStatsForPlayer } from "@/lib/build-lane-peer-stats";
import { role_type } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const tournament = await prisma.tournaments.findUnique({
    where: { id },
    include: {
      _count: {
        select: { tournament_players: true, teams: true },
      },
      teams: {
        include: {
          team_members: {
            include: {
              users: { include: { profiles: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  const isCreator = tournament.created_by === session.user.id;
  const myRow = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: {
        tournament_id: id,
        user_id: session.user.id,
      },
    },
  });

  const isPlayer = !!myRow;

  if (!isCreator && !isPlayer) notFound();

  const registrations = await prisma.tournament_players.findMany({
    where: { tournament_id: id },
    include: {
      users: {
        include: { profiles: true },
      },
    },
    orderBy: { created_at: "asc" },
  });

  const peerRatings = await prisma.tournament_peer_ratings.findMany({
    where: { tournament_id: id },
    include: {
      rater: { include: { profiles: true } },
    },
  });

  const players: RegisteredPlayerVM[] = registrations.map((r) => ({
    userId: r.user_id,
    nickname: r.users.profiles?.nickname ?? "Jogador",
    avatarUrl: r.users.profiles?.avatar_url ?? null,
    preferredRoles: [...(r.preferred_roles ?? [])],
    laneStats: buildLanePeerStatsForPlayer(
      r.user_id,
      (r.preferred_roles ?? []) as role_type[],
      peerRatings,
    ),
  }));

  const teamCards: TeamCardVM[] = tournament.teams.map((team) => ({
    id: team.id,
    name: team.name,
    totalRating: toNum(team.total_rating),
    captainUserId: team.captain_user_id,
    members: team.team_members.map((tm) => ({
      userId: tm.user_id,
      nickname: tm.users.profiles?.nickname ?? "Jogador",
      avatarUrl: tm.users.profiles?.avatar_url ?? null,
      role: tm.assigned_role,
      ratingUsed: toNum(tm.rating_used),
    })),
  }));

  const nPlayers = registrations.length;
  const canGenerateTeams = nPlayers >= 5 && nPlayers % 5 === 0;
  const canStartDraft = nPlayers >= 5 && nPlayers % 5 === 0;
  const draftTeamCount = canStartDraft ? nPlayers / 5 : 0;
  const isDraftMode = tournament.team_formation_mode === team_formation_mode.CAPTAIN_DRAFT;

  const nTeams = tournament.teams.length;
  const canGenerateBracket =
    nTeams >= 2 && isPowerOfTwoTeamCount(nTeams);
  const bracketReason =
    nTeams < 2
      ? "É necessário pelo menos 2 times (gere os times primeiro)."
      : !isPowerOfTwoTeamCount(nTeams)
        ? `O número de times tem de ser potência de 2 para o chaveamento (atualmente: ${nTeams}).`
        : undefined;

  const matchCount = await prisma.matches.count({ where: { tournament_id: id } });

  const registrationInitial = {
    preferred_roles: [...(myRow?.preferred_roles ?? [])],
  };

  const leaveBlockedReason = leaveTournamentBlockedReason({
    status: tournament.status,
    teamsCount: tournament._count.teams,
    draftState: tournament.draft_state,
    matchCount,
  });

  return (
    <div className="space-y-8">
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Torneios
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
        <p className="mt-1 text-sm text-tm-muted">
          {isCreator
            ? "Você é o organizador deste torneio."
            : "Você está inscrito como jogador."}
        </p>
        {tournament.status === tournament_status.FINISHED ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-100">Torneio finalizado</p>
            <Link
              href={`/tournaments/${id}/resumo`}
              className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-amber-300 underline-offset-2 hover:underline"
            >
              Ver resumo final — campeão, vice, MVP e histórico
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
        <div className="flex items-start gap-3 text-sm">
          <Hash className="mt-0.5 h-5 w-5 shrink-0 text-tm-cyan" />
          <div>
            <p className="text-xs uppercase text-tm-muted">Código de convite</p>
            <code className="text-lg font-semibold tracking-widest text-white">
              {tournament.invite_code}
            </code>
          </div>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-tm-purple" />
          <div>
            <p className="text-xs uppercase text-tm-muted">Início</p>
            <p className="text-white">
              {tournament.start_date.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {tournament.end_date ? (
              <p className="mt-1 text-tm-muted">
                Fim: {tournament.end_date.toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Users className="h-5 w-5 text-tm-muted" />
          <span className="text-tm-muted">
            Estado: <span className="text-white">{tournament.status}</span> · Formato:{" "}
            <span className="text-white">{tournament.format}</span> · Formação:{" "}
            <span className="text-white">{tournament.team_formation_mode}</span>
          </span>
        </div>
        <div className="flex gap-6 border-t border-white/5 pt-3 text-sm text-tm-muted">
          <span>
            Jogadores:{" "}
            <strong className="text-white">{tournament._count.tournament_players}</strong>
          </span>
          <span>
            Times:{" "}
            <strong className="text-white">{tournament._count.teams}</strong>
          </span>
        </div>
        <div className="border-t border-white/5 pt-3">
          <Link
            href={`/tournaments/${id}/avaliacoes`}
            className="inline-flex items-center gap-2 text-sm font-medium text-tm-cyan transition hover:underline"
          >
            <Star className="h-4 w-4" />
            Avaliações entre jogadores (por lane, 0–100)
          </Link>
        </div>
        <div className="border-t border-white/5 pt-3">
          <Link
            href={`/tournaments/${id}/chaveamento`}
            className="inline-flex items-center gap-2 text-sm font-medium text-tm-purple transition hover:underline"
          >
            Ver chaveamento
            {matchCount > 0 ? (
              <span className="text-tm-muted">
                ({matchCount} partida{matchCount !== 1 ? "s" : ""})
              </span>
            ) : null}
          </Link>
        </div>
        {isDraftMode ? (
          <div className="border-t border-white/5 pt-3">
            <Link
              href={`/tournaments/${id}/draft`}
              className="inline-flex items-center gap-2 text-sm font-medium text-tm-cyan transition hover:underline"
            >
              Draft por capitães
            </Link>
          </div>
        ) : null}
        <div className="border-t border-white/5 pt-3">
          <Link
            href={`/tournaments/${id}/mvp`}
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-400/90 transition hover:underline"
          >
            <Trophy className="h-4 w-4" />
            Ranking MVP do torneio
          </Link>
        </div>
        <div className="border-t border-white/5 pt-3">
          <Link
            href={`/tournaments/${id}/resumo`}
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400/90 transition hover:underline"
          >
            <ScrollText className="h-4 w-4" />
            Resumo final e histórico
          </Link>
        </div>
      </div>

      {isPlayer ? (
        <>
          <TournamentRegistrationForm
            tournamentId={id}
            action={saveTournamentRegistration}
            initial={registrationInitial}
          />
          <section className="rounded-2xl border border-red-500/15 bg-red-500/[0.06] p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-200/90">
              Inscrição
            </h2>
            <p className="mb-4 text-xs text-tm-muted">
              Só pode sair antes de existirem times, de o draft começar ou de haver partidas no chaveamento.
            </p>
            <LeaveTournamentForm
              tournamentId={id}
              disabled={leaveBlockedReason !== null}
              disabledReason={leaveBlockedReason}
            />
          </section>
        </>
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          Inscritos ({players.length})
        </h2>
        <RegisteredPlayersList players={players} />
      </section>

      {isCreator && !isDraftMode ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Geração de times
          </h2>
          <GenerateTeamsForm
            tournamentId={id}
            disabled={!canGenerateTeams}
            disabledReason={
              nPlayers < 5
                ? "É necessário pelo menos 5 jogadores inscritos."
                : !canGenerateTeams
                  ? `O número de inscritos precisa ser múltiplo de 5 para formar times completos (atualmente: ${nPlayers}).`
                  : undefined
            }
          />
        </section>
      ) : null}

      {isCreator && isDraftMode ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Draft por capitães
          </h2>
          <p className="mb-3 text-xs text-tm-muted">
            Regra ativa: número de inscritos deve ser divisível por 5. A ordem inicial dos capitães é aleatória
            e as rodadas seguem snake.
          </p>
          {!canStartDraft ? (
            <p className="text-sm text-tm-muted">
              É necessário número de inscritos divisível por 5 para iniciar o draft (atualmente: {nPlayers}).
            </p>
          ) : (
            <StartCaptainDraftForm
              tournamentId={id}
              teamCount={draftTeamCount}
              captainsPool={players.map((p) => ({ userId: p.userId, nickname: p.nickname }))}
            />
          )}
          <div className="mt-3 border-t border-white/10 pt-3 text-sm">
            <Link href={`/tournaments/${id}/draft`} className="font-medium text-tm-cyan hover:underline">
              Abrir tela do draft
            </Link>
            <p className="mt-1 text-xs text-tm-muted">Estado atual: {tournament.draft_state ?? draft_state.PENDING}</p>
          </div>
        </section>
      ) : null}

      {isCreator ? (
        <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Chaveamento
          </h2>
          <GenerateBracketForm
            tournamentId={id}
            disabled={!canGenerateBracket}
            disabledReason={bracketReason}
          />
        </section>
      ) : null}

      {isCreator ? (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-300/90">
            Zona de perigo
          </h2>
          <p className="mb-4 text-xs text-tm-muted">
            Só o organizador pode apagar o torneio. Esta ação remove tudo o que está ligado a ele na base de
            dados.
          </p>
          <DeleteTournamentForm tournamentId={id} />
        </section>
      ) : null}

      <TournamentTeamsList teams={teamCards} />
    </div>
  );
}
