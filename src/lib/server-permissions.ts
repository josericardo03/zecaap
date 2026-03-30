import type { PrismaClient } from "@/generated/prisma/client";

export type PermissionResult = { ok: true } | { ok: false; error: string };

export type OrganizerOk = {
  ok: true;
  tournament: { id: string; created_by: string | null };
};

/**
 * Apenas o utilizador que criou o torneio (organizador / “admin” do torneio).
 */
export async function assertTournamentOrganizer(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
): Promise<OrganizerOk | { ok: false; error: string }> {
  const t = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { id: true, created_by: true },
  });
  if (!t) return { ok: false, error: "Torneio não encontrado." };
  if (t.created_by !== userId) {
    return { ok: false, error: "Apenas o organizador do torneio pode fazer isto." };
  }
  return { ok: true, tournament: t };
}

/**
 * Linha em `tournament_players` (inscrito no torneio).
 */
export async function assertEnrolledInTournament(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
): Promise<PermissionResult> {
  const row = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: { tournament_id: tournamentId, user_id: userId },
    },
  });
  if (!row) {
    return {
      ok: false,
      error: "Só jogadores inscritos neste torneio podem fazer isto.",
    };
  }
  return { ok: true };
}

/**
 * Edição de nome / descrição / logo do time (capitão).
 */
export async function assertTeamCaptain(
  prisma: PrismaClient,
  teamId: string,
  userId: string
): Promise<PermissionResult> {
  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    select: { captain_user_id: true },
  });
  if (!team) return { ok: false, error: "Time não encontrado." };
  if (team.captain_user_id !== userId) {
    return {
      ok: false,
      error: "Só o capitão pode editar nome, descrição e logo.",
    };
  }
  return { ok: true };
}
