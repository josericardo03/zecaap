import type { PrismaClient } from "@/generated/prisma/client";

export async function getTournamentViewerContext(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  const tournament = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true, created_by: true },
  });
  if (!tournament) return null;

  const isOrganizer = tournament.created_by === userId;
  if (isOrganizer) {
    return { tournament, isOrganizer: true as const };
  }

  const enrolled = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: { tournament_id: tournamentId, user_id: userId },
    },
  });
  if (!enrolled) return null;

  return { tournament, isOrganizer: false as const };
}
