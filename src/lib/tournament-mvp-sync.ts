import type { PrismaClient } from "@/generated/prisma/client";
import { tournament_status } from "@/generated/prisma/client";

/**
 * Define `tournament_results.tournament_mvp_user_id` pelo jogador com mais votos MVP
 * no torneio (empate → desempate determinístico por UUID).
 */
export async function syncTournamentMvpUserId(
  prisma: PrismaClient,
  tournamentId: string
): Promise<void> {
  const tour = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });
  if (tour?.status !== tournament_status.FINISHED) return;

  const agg = await prisma.match_mvp_votes.groupBy({
    by: ["voted_user_id"],
    where: {
      matches: { tournament_id: tournamentId },
    },
    _count: { _all: true },
  });

  if (agg.length === 0) {
    await prisma.tournament_results.updateMany({
      where: { tournament_id: tournamentId },
      data: { tournament_mvp_user_id: null },
    });
    return;
  }

  const sorted = [...agg].sort((a, b) => {
    if (b._count._all !== a._count._all) return b._count._all - a._count._all;
    return a.voted_user_id.localeCompare(b.voted_user_id);
  });
  const winnerId = sorted[0].voted_user_id;

  await prisma.tournament_results.updateMany({
    where: { tournament_id: tournamentId },
    data: { tournament_mvp_user_id: winnerId },
  });
}
