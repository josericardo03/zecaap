"use server";

import { Prisma, team_formation_mode } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { balanceTeams, type PlayerForBalance } from "@/lib/balance-teams";
import { getPeerLaneAveragesForTournament } from "@/lib/peer-balance-ratings";
import { getPrisma } from "@/lib/prisma";
import { assertTournamentOrganizer } from "@/lib/server-permissions";
import { createClient } from "@/utils/supabase/server";

export type GenerateTeamsState = { error?: string; success?: boolean } | null;

export async function generateBalancedTeams(
  _prev: GenerateTeamsState,
  formData: FormData
): Promise<GenerateTeamsState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const org = await assertTournamentOrganizer(prisma, tournamentId, user.id);
  if (!org.ok) return { error: org.error };
  const t = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { team_formation_mode: true },
  });
  if (!t) return { error: "Torneio não encontrado." };
  if (t.team_formation_mode !== team_formation_mode.ALGORITHM) {
    return {
      error:
        "Este torneio está em modo Draft por Capitães. Use a tela de draft para montar os times.",
    };
  }

  const players = await prisma.tournament_players.findMany({
    where: { tournament_id: tournamentId },
  });

  const n = players.length;
  if (n < 5) return { error: "É necessário pelo menos 5 jogadores inscritos." };
  if (n % 5 !== 0) {
    return {
      error: `O número de inscritos precisa ser múltiplo de 5 (atualmente: ${n}).`,
    };
  }

  const peerAvgs = await getPeerLaneAveragesForTournament(prisma, tournamentId);
  const playersForBalance: PlayerForBalance[] = players.map((p) => {
    const a = peerAvgs.get(p.user_id);
    return {
      ...p,
      rating_top: a?.rating_top ?? 0,
      rating_jungle: a?.rating_jungle ?? 0,
      rating_mid: a?.rating_mid ?? 0,
      rating_adc: a?.rating_adc ?? 0,
      rating_support: a?.rating_support ?? 0,
    };
  });

  let balanced;
  try {
    balanced = balanceTeams(playersForBalance);
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "INFEASIBLE_LANES") {
      return {
        error:
          "Não dá para formar 5 posições por time com as lanes que cada um marcou. Peça para alguém incluir mais lanes ou ajustar as escolhas.",
      };
    }
    return { error: "Não foi possível formar times. Tente novamente." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tournament_results.updateMany({
        where: { tournament_id: tournamentId },
        data: {
          champion_team_id: null,
          runner_up_team_id: null,
          tournament_mvp_user_id: null,
        },
      });
      await tx.matches.deleteMany({ where: { tournament_id: tournamentId } });
      await tx.teams.deleteMany({ where: { tournament_id: tournamentId } });

      for (const t of balanced) {
        const team = await tx.teams.create({
          data: {
            tournament_id: tournamentId,
            name: `Time ${t.teamIndex + 1}`,
            total_rating: new Prisma.Decimal(Math.round(t.totalRating * 100) / 100),
            captain_user_id: t.captainUserId,
          },
        });

        for (const m of t.members) {
          await tx.team_members.create({
            data: {
              team_id: team.id,
              user_id: m.userId,
              assigned_role: m.role,
              rating_used: new Prisma.Decimal(Math.round(m.ratingUsed * 100) / 100),
            },
          });
        }
      }
    });
  } catch (e) {
    console.error(e);
    return { error: "Erro ao salvar times no banco de dados." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  revalidatePath(`/tournaments/${tournamentId}/mvp`);
  return { success: true };
}
