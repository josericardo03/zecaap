import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { match_status } from "@/generated/prisma/client";
import { roundLabel } from "@/lib/bracket-utils";
import { getPrisma } from "@/lib/prisma";
import { getTournamentViewerContext } from "@/lib/tournament-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ChaveamentoPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const ctx = await getTournamentViewerContext(prisma, id, session.user.id);
  if (!ctx) notFound();

  const matches = await prisma.matches.findMany({
    where: { tournament_id: id },
    include: {
      teams_matches_team_a_idToteams: { select: { id: true, name: true } },
      teams_matches_team_b_idToteams: { select: { id: true, name: true } },
      teams_matches_winner_team_idToteams: { select: { id: true, name: true } },
    },
    orderBy: [{ round: "asc" }, { position_in_round: "asc" }],
  });

  const maxRound = matches.reduce((acc, m) => Math.max(acc, m.round), 0);
  const totalRounds = Math.max(maxRound, 1);

  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Torneio
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Chaveamento</h1>
        <p className="mt-1 text-sm text-tm-muted">{ctx.tournament.name}</p>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6 text-sm text-tm-muted">
          Ainda não há partidas. O organizador pode gerar o chaveamento na página do torneio.
        </p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max flex-row gap-8">
            {roundNumbers.map((r) => (
              <div key={r} className="flex w-56 shrink-0 flex-col gap-4">
                <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-tm-purple">
                  {roundLabel(r, totalRounds)}
                </h2>
                {(byRound.get(r) ?? []).map((m) => {
                  const a = m.teams_matches_team_a_idToteams;
                  const b = m.teams_matches_team_b_idToteams;
                  const w = m.teams_matches_winner_team_idToteams;
                  const done = m.status === match_status.FINISHED;
                  return (
                    <Link
                      key={m.id}
                      href={`/tournaments/${id}/partidas/${m.id}`}
                      className="block rounded-xl border border-white/10 bg-tm-surface/90 p-3 transition hover:border-tm-cyan/40"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={
                            done
                              ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                              : "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                          }
                        >
                          {done ? "Concluída" : "Pendente"}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div
                          className={`rounded-lg px-2 py-1.5 ${
                            done && w?.id === a?.id ? "bg-tm-cyan/15 text-tm-cyan" : "bg-white/5 text-white"
                          }`}
                        >
                          {a?.name ?? "A definir"}
                        </div>
                        <div className="text-center text-xs text-tm-muted">vs</div>
                        <div
                          className={`rounded-lg px-2 py-1.5 ${
                            done && w?.id === b?.id ? "bg-tm-cyan/15 text-tm-cyan" : "bg-white/5 text-white"
                          }`}
                        >
                          {b?.name ?? "A definir"}
                        </div>
                        {done ? (
                          <p className="text-center text-xs text-tm-muted">
                            {m.score_a ?? 0} — {m.score_b ?? 0}
                          </p>
                        ) : (
                          <p className="text-center text-xs text-tm-muted">Pendente</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
