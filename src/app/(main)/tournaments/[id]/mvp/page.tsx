import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { getTournamentViewerContext } from "@/lib/tournament-access";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TournamentMvpRankingPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const ctx = await getTournamentViewerContext(prisma, id, session.user.id);
  if (!ctx) notFound();

  const agg = await prisma.match_mvp_votes.groupBy({
    by: ["voted_user_id"],
    where: {
      matches: {
        tournament_id: id,
      },
    },
    _count: { _all: true },
  });

  const sorted = [...agg].sort((a, b) => b._count._all - a._count._all);

  const userIds = sorted.map((r) => r.voted_user_id);
  const profiles = await prisma.profiles.findMany({
    where: { id: { in: userIds } },
  });
  const profileById = new Map(profiles.map((p) => [p.id, p]));

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
        <div className="flex items-center gap-2">
          <Trophy className="h-7 w-7 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Ranking MVP do torneio</h1>
        </div>
        <p className="mt-1 text-sm text-tm-muted">{ctx.tournament.name}</p>
        <p className="mt-2 text-xs text-tm-muted">
          Soma de votos MVP em todas as partidas concluídas deste torneio.
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6 text-sm text-tm-muted">
          Ainda não há votos MVP. Quando as partidas terminarem, os jogadores podem votar em cada jogo.
        </p>
      ) : (
        <ol className="space-y-3">
          {sorted.map((row, index) => {
            const prof = profileById.get(row.voted_user_id);
            const rank = index + 1;
            return (
              <li
                key={row.voted_user_id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-tm-surface/90 px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                  {rank}
                </span>
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10">
                  {prof?.avatar_url ? (
                    <Image src={prof.avatar_url} alt="" fill className="object-cover" sizes="44px" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/40 text-xs font-bold text-tm-cyan">
                      {(prof?.nickname ?? "J").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{prof?.nickname ?? "Jogador"}</p>
                  <p className="text-xs text-tm-muted">
                    {row._count._all} voto{row._count._all !== 1 ? "s" : ""} MVP no total
                  </p>
                </div>
                {rank === 1 ? (
                  <Trophy className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
