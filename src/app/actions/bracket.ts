"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { draft_state, match_status, team_formation_mode, tournament_status } from "@/generated/prisma/client";
import { isPowerOfTwoTeamCount } from "@/lib/bracket-utils";
import { getPrisma } from "@/lib/prisma";
import { assertTournamentOrganizer } from "@/lib/server-permissions";
import { syncTournamentMvpUserId } from "@/lib/tournament-mvp-sync";
import { createClient } from "@/utils/supabase/server";

export type BracketActionState = { error?: string; success?: boolean } | null;

async function requireOrganizer(tournamentId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Você precisa estar logado." as const, user: null, prisma: null };
  }

  const prisma = getPrisma();
  const check = await assertTournamentOrganizer(prisma, tournamentId, user.id);
  if (!check.ok) {
    return { error: check.error, user: null, prisma: null };
  }
  return { error: null, user, prisma };
}

export async function generateBracket(
  _prev: BracketActionState,
  formData: FormData
): Promise<BracketActionState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const gate = await requireOrganizer(tournamentId);
  if (gate.error || !gate.prisma) return { error: gate.error ?? "Erro." };

  const teams = await gate.prisma.teams.findMany({
    where: { tournament_id: tournamentId },
    orderBy: { created_at: "asc" },
    include: { _count: { select: { team_members: true } } },
  });

  const t = teams.length;
  if (t < 2) {
    return { error: "É necessário pelo menos 2 times para o chaveamento." };
  }
  if (!isPowerOfTwoTeamCount(t)) {
    return {
      error:
        "O número de times tem de ser uma potência de 2 (2, 4, 8, 16…) para eliminação simples sem byes.",
    };
  }

  const tInfo = await gate.prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { team_formation_mode: true, draft_state: true },
  });
  if (!tInfo) return { error: "Torneio não encontrado." };
  if (tInfo.team_formation_mode === team_formation_mode.CAPTAIN_DRAFT) {
    if (tInfo.draft_state !== draft_state.COMPLETED) {
      return { error: "Finalize o draft por capitães antes de gerar o chaveamento." };
    }
    const incomplete = teams.find((team) => team._count.team_members !== 5);
    if (incomplete) {
      return { error: "Há times incompletos no draft. Complete todos com 5 jogadores." };
    }
  }

  const teamIds = teams.map((x) => x.id);

  try {
    await gate.prisma.$transaction(async (tx) => {
      await tx.tournament_results.updateMany({
        where: { tournament_id: tournamentId },
        data: {
          champion_team_id: null,
          runner_up_team_id: null,
          tournament_mvp_user_id: null,
        },
      });
      await tx.matches.deleteMany({ where: { tournament_id: tournamentId } });

      await tx.tournaments.update({
        where: { id: tournamentId },
        data: { status: tournament_status.IN_PROGRESS },
      });

      let prevRoundIds: string[] = [];
      for (let i = 0; i < teamIds.length / 2; i++) {
        const m = await tx.matches.create({
          data: {
            tournament_id: tournamentId,
            round: 1,
            position_in_round: i,
            team_a_id: teamIds[2 * i],
            team_b_id: teamIds[2 * i + 1],
            status: match_status.PENDING,
          },
        });
        prevRoundIds.push(m.id);
      }

      let round = 2;
      while (prevRoundIds.length > 1) {
        const nextIds: string[] = [];
        for (let i = 0; i < prevRoundIds.length; i += 2) {
          const m = await tx.matches.create({
            data: {
              tournament_id: tournamentId,
              round,
              position_in_round: i / 2,
              source_match_a_id: prevRoundIds[i],
              source_match_b_id: prevRoundIds[i + 1],
              status: match_status.PENDING,
            },
          });
          nextIds.push(m.id);
        }
        prevRoundIds = nextIds;
        round++;
      }
    });
  } catch (e) {
    console.error(e);
    return { error: "Erro ao criar partidas no banco de dados." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/chaveamento`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  return { success: true };
}

export async function updateMatchPrintUrlAction(
  matchId: string,
  tournamentId: string,
  urlRaw: string | null
): Promise<BracketActionState> {
  const gate = await requireOrganizer(tournamentId);
  if (gate.error || !gate.prisma) return { error: gate.error ?? "Erro." };

  const match = await gate.prisma.matches.findFirst({
    where: { id: matchId, tournament_id: tournamentId },
  });
  if (!match) return { error: "Partida não encontrada." };

  const trimmed = (urlRaw ?? "").trim();
  if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
    return { error: "O link do print deve ser uma URL http(s) válida." };
  }

  await gate.prisma.matches.update({
    where: { id: matchId },
    data: { match_image_url: trimmed || null },
  });

  revalidatePath(`/tournaments/${tournamentId}/partidas/${matchId}`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  return { success: true };
}

export async function updateMatchScheduleAction(
  matchId: string,
  tournamentId: string,
  isoUtc: string | null
): Promise<BracketActionState> {
  const gate = await requireOrganizer(tournamentId);
  if (gate.error || !gate.prisma) return { error: gate.error ?? "Erro." };

  const match = await gate.prisma.matches.findFirst({
    where: { id: matchId, tournament_id: tournamentId },
  });
  if (!match) return { error: "Partida não encontrada." };

  const matchDate =
    isoUtc && isoUtc.trim() !== "" ? new Date(isoUtc) : null;
  if (matchDate && Number.isNaN(matchDate.getTime())) {
    return { error: "Data/hora inválida." };
  }

  await gate.prisma.matches.update({
    where: { id: matchId },
    data: { match_date: matchDate },
  });

  revalidatePath(`/tournaments/${tournamentId}/chaveamento`);
  revalidatePath(`/tournaments/${tournamentId}/partidas/${matchId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  return { success: true };
}

/**
 * Regista placar, define `winner_team_id` pelo resultado (maior pontuação)
 * ou por `tieBreakerTeamId` se os placares forem iguais. Atualiza a partida seguinte no bracket e,
 * na final, `tournament_results` e estado do torneio como FINISHED.
 */
export async function setMatchResultAction(
  matchId: string,
  tournamentId: string,
  scoreA: number,
  scoreB: number,
  tieBreakerTeamId?: string | null
): Promise<BracketActionState> {
  const gate = await requireOrganizer(tournamentId);
  if (gate.error || !gate.prisma) return { error: gate.error ?? "Erro." };

  const match = await gate.prisma.matches.findFirst({
    where: { id: matchId, tournament_id: tournamentId },
    include: {
      teams_matches_team_a_idToteams: { select: { id: true } },
      teams_matches_team_b_idToteams: { select: { id: true } },
    },
  });
  if (!match) return { error: "Partida não encontrada." };

  if (match.status === match_status.FINISHED) {
    return { error: "Esta partida já está concluída." };
  }

  const aId = match.team_a_id;
  const bId = match.team_b_id;
  if (!aId || !bId) {
    return { error: "Ainda não há dois times definidos nesta partida." };
  }
  if (scoreA < 0 || scoreB < 0 || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { error: "Placares têm de ser números inteiros ≥ 0." };
  }

  let winnerTeamId: string;
  if (scoreA > scoreB) {
    winnerTeamId = aId;
  } else if (scoreB > scoreA) {
    winnerTeamId = bId;
  } else {
    const tie = (tieBreakerTeamId ?? "").trim();
    if (!tie || (tie !== aId && tie !== bId)) {
      return {
        error:
          "Empate: indica qual time venceu (ex.: vitória por WO ou decisão do organizador).",
      };
    }
    winnerTeamId = tie;
  }

  const maxR = await gate.prisma.matches.aggregate({
    where: { tournament_id: tournamentId },
    _max: { round: true },
  });
  const finalRound = maxR._max.round ?? 1;
  const loserTeamId = winnerTeamId === aId ? bId : aId;

  await gate.prisma.$transaction(async (tx) => {
    await tx.matches.update({
      where: { id: matchId },
      data: {
        score_a: scoreA,
        score_b: scoreB,
        winner_team_id: winnerTeamId,
        status: match_status.FINISHED,
      },
    });

    const children = await tx.matches.findMany({
      where: {
        OR: [{ source_match_a_id: matchId }, { source_match_b_id: matchId }],
      },
    });
    for (const c of children) {
      const data: { team_a_id?: string; team_b_id?: string } = {};
      if (c.source_match_a_id === matchId) data.team_a_id = winnerTeamId;
      if (c.source_match_b_id === matchId) data.team_b_id = winnerTeamId;
      if (Object.keys(data).length > 0) {
        await tx.matches.update({ where: { id: c.id }, data });
      }
    }

    if (match.round === finalRound) {
      await tx.tournament_results.upsert({
        where: { tournament_id: tournamentId },
        create: {
          tournament_id: tournamentId,
          champion_team_id: winnerTeamId,
          runner_up_team_id: loserTeamId,
        },
        update: {
          champion_team_id: winnerTeamId,
          runner_up_team_id: loserTeamId,
        },
      });
      await tx.tournaments.update({
        where: { id: tournamentId },
        data: { status: tournament_status.FINISHED },
      });
    }
  });

  if (match.round === finalRound) {
    await syncTournamentMvpUserId(gate.prisma, tournamentId);
  }

  revalidatePath(`/tournaments/${tournamentId}/chaveamento`);
  revalidatePath(`/tournaments/${tournamentId}/partidas/${matchId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/resumo`);
  revalidatePath(`/tournaments/${tournamentId}/mvp`);
  return { success: true };
}
