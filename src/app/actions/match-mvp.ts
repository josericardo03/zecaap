"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { match_status, tournament_status } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { assertEnrolledInTournament } from "@/lib/server-permissions";
import { syncTournamentMvpUserId } from "@/lib/tournament-mvp-sync";
import { createClient } from "@/utils/supabase/server";

export type MatchMvpVoteState = { error?: string; success?: boolean } | null;

export async function castMvpVote(
  _prev: MatchMvpVoteState,
  formData: FormData
): Promise<MatchMvpVoteState> {
  const matchId = (formData.get("match_id") as string)?.trim();
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  const votedUserId = (formData.get("voted_user_id") as string)?.trim();

  if (!matchId || !tournamentId || !votedUserId) {
    return { error: "Dados em falta." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const enrolled = await assertEnrolledInTournament(prisma, tournamentId, user.id);
  if (!enrolled.ok) return { error: enrolled.error };

  const match = await prisma.matches.findFirst({
    where: { id: matchId, tournament_id: tournamentId },
    select: {
      id: true,
      status: true,
      team_a_id: true,
      team_b_id: true,
    },
  });
  if (!match) return { error: "Partida não encontrada." };
  if (match.status !== match_status.FINISHED) {
    return { error: "Só é possível votar após a partida estar concluída." };
  }
  if (!match.team_a_id || !match.team_b_id) {
    return { error: "Times desta partida ainda não estão definidos." };
  }

  const roster = await prisma.team_members.findMany({
    where: { team_id: { in: [match.team_a_id, match.team_b_id] } },
    select: { user_id: true },
  });
  const allowed = new Set(roster.map((r) => r.user_id));
  if (!allowed.has(votedUserId)) {
    return { error: "Só podes votar num jogador que participou nesta partida." };
  }

  try {
    await prisma.match_mvp_votes.upsert({
      where: {
        match_id_voter_user_id: {
          match_id: matchId,
          voter_user_id: user.id,
        },
      },
      create: {
        match_id: matchId,
        voter_user_id: user.id,
        voted_user_id: votedUserId,
      },
      update: {
        voted_user_id: votedUserId,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Não foi possível guardar o voto." };
  }

  const tour = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });
  if (tour?.status === tournament_status.FINISHED) {
    await syncTournamentMvpUserId(prisma, tournamentId);
  }

  revalidatePath(`/tournaments/${tournamentId}/partidas/${matchId}`);
  revalidatePath(`/tournaments/${tournamentId}/mvp`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}
