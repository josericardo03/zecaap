import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar, Crown, ImageIcon, Medal, Trophy } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { match_status, tournament_status } from "@/generated/prisma/client";
import { roundLabel } from "@/lib/bracket-utils";
import { getPrisma } from "@/lib/prisma";
import { getTournamentViewerContext } from "@/lib/tournament-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TournamentResumoPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const ctx = await getTournamentViewerContext(prisma, id, session.user.id);
  if (!ctx) notFound();

  const tournament = await prisma.tournaments.findUnique({
    where: { id },
    include: {
      tournament_results: {
        include: {
          teams_tournament_results_champion_team_idToteams: {
            select: { id: true, name: true, logo_url: true },
          },
          teams_tournament_results_runner_up_team_idToteams: {
            select: { id: true, name: true, logo_url: true },
          },
          users: {
            include: { profiles: true },
          },
        },
      },
    },
  });

  if (!tournament) notFound();

  const tr = tournament.tournament_results;
  const champ = tr?.teams_tournament_results_champion_team_idToteams;
  const runner = tr?.teams_tournament_results_runner_up_team_idToteams;
  const mvpUser = tr?.users;
  const mvpProfile = mvpUser?.profiles;

  const matches = await prisma.matches.findMany({
    where: { tournament_id: id },
    orderBy: [{ round: "asc" }, { position_in_round: "asc" }],
    include: {
      teams_matches_team_a_idToteams: { select: { name: true } },
      teams_matches_team_b_idToteams: { select: { name: true } },
      teams_matches_winner_team_idToteams: { select: { name: true } },
    },
  });

  const maxRound = matches.reduce((acc, m) => Math.max(acc, m.round), 0);
  const totalRounds = Math.max(maxRound, 1);

  const isFinished = tournament.status === tournament_status.FINISHED;

  return (
    <div className="space-y-10">
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Torneio
      </Link>

      <div className="rounded-2xl border border-amber-500/25 bg-linear-to-br from-amber-500/10 to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Trophy className="h-10 w-10 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Resumo final</h1>
            <p className="mt-1 text-sm text-tm-muted">{tournament.name}</p>
          </div>
        </div>
        {!isFinished ? (
          <p className="mt-4 text-sm text-tm-muted">
            O torneio ainda não está marcado como finalizado. Quando a final for registada, o pódio e o MVP
            oficial aparecem aqui. Já podes consultar o histórico de partidas abaixo.
          </p>
        ) : (
          <p className="mt-4 text-sm text-emerald-200/90">
            Torneio concluído — campeão, vice e MVP guardados em{" "}
            <code className="rounded bg-white/10 px-1 text-xs">tournament_results</code>.
          </p>
        )}
      </div>

      {isFinished && (champ || runner || mvpProfile) ? (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-amber-400/30 bg-tm-surface/90 p-5">
            <div className="flex items-center gap-2 text-amber-400">
              <Crown className="h-6 w-6" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Campeão</h2>
            </div>
            {champ ? (
              <>
                <p className="mt-3 text-xl font-bold text-white">{champ.name}</p>
                <Link
                  href={`/teams/${champ.id}`}
                  className="mt-2 inline-block text-sm text-tm-cyan hover:underline"
                >
                  Ver time
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-tm-muted">—</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/15 bg-tm-surface/90 p-5">
            <div className="flex items-center gap-2 text-tm-muted">
              <Medal className="h-6 w-6 text-slate-300" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Vice-campeão</h2>
            </div>
            {runner ? (
              <>
                <p className="mt-3 text-xl font-bold text-white">{runner.name}</p>
                <Link
                  href={`/teams/${runner.id}`}
                  className="mt-2 inline-block text-sm text-tm-cyan hover:underline"
                >
                  Ver time
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-tm-muted">—</p>
            )}
          </div>

          <div className="rounded-2xl border border-tm-purple/30 bg-tm-surface/90 p-5">
            <div className="flex items-center gap-2 text-tm-purple">
              <Trophy className="h-6 w-6" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">MVP do torneio</h2>
            </div>
            {mvpProfile ? (
              <div className="mt-3 flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10">
                  {mvpProfile.avatar_url ? (
                    <Image
                      src={mvpProfile.avatar_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/40 text-sm font-bold text-tm-cyan">
                      {mvpProfile.nickname.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="text-lg font-semibold text-white">{mvpProfile.nickname}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-tm-muted">
                Ainda sem MVP oficial (sem votos ou a aguardar sincronização após a final).
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-tm-muted">
          <Calendar className="h-4 w-4" />
          Histórico de partidas
        </h2>
        {matches.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6 text-sm text-tm-muted">
            Sem partidas registadas.
          </p>
        ) : (
          <ul className="space-y-4">
            {matches.map((m) => {
              const label = roundLabel(m.round, totalRounds);
              const a = m.teams_matches_team_a_idToteams?.name ?? "—";
              const b = m.teams_matches_team_b_idToteams?.name ?? "—";
              const w = m.teams_matches_winner_team_idToteams?.name;
              const done = m.status === match_status.FINISHED;
              return (
                <li
                  key={m.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-tm-surface/90"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase text-tm-purple">{label}</p>
                      <p className="mt-1 text-white">
                        <span className="font-medium">{a}</span>
                        <span className="mx-2 text-tm-muted">vs</span>
                        <span className="font-medium">{b}</span>
                      </p>
                      {done ? (
                        <p className="mt-2 text-sm text-tm-muted">
                          Resultado: {m.score_a ?? 0} — {m.score_b ?? 0}
                          {w ? (
                            <>
                              {" "}
                              · Vencedor: <span className="text-tm-cyan">{w}</span>
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-amber-200/80">Partida pendente</p>
                      )}
                      <Link
                        href={`/tournaments/${id}/partidas/${m.id}`}
                        className="mt-2 inline-block text-sm text-tm-cyan hover:underline"
                      >
                        Abrir detalhes da partida
                      </Link>
                    </div>
                    {m.match_image_url ? (
                      <div className="sm:w-56 shrink-0">
                        <p className="mb-1 flex items-center gap-1 text-xs text-tm-muted">
                          <ImageIcon className="h-3.5 w-3.5" />
                          Print
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- URLs arbitrárias do organizador */}
                        <img
                          src={m.match_image_url}
                          alt=""
                          className="max-h-40 w-full rounded-lg border border-white/10 object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-tm-muted">
        <Link href={`/tournaments/${id}/mvp`} className="text-tm-cyan hover:underline">
          Ver ranking completo de votos MVP
        </Link>
      </p>
    </div>
  );
}
