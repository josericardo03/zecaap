"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { draft_state, draft_timeout_policy, role_type, team_formation_mode, tournament_status } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { assertTournamentOrganizer } from "@/lib/server-permissions";
import { createClient } from "@/utils/supabase/server";

export type CaptainDraftState = { error?: string; success?: boolean } | null;

const TEAM_SIZE = 5;
const ROLES_ORDER: role_type[] = [
  role_type.TOP,
  role_type.JUNGLE,
  role_type.MID,
  role_type.ADC,
  role_type.SUPPORT,
];

function shuffled<T>(arr: T[]): T[] {
  const v = [...arr];
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
}

function currentTurn(order: string[], done: number) {
  const teamCount = order.length;
  const round = Math.floor(done / teamCount) + 1;
  const pos = done % teamCount;
  const captainTurnId = round % 2 === 1 ? order[pos] : order[teamCount - 1 - pos];
  return { round, captainTurnId };
}

async function getAvailablePlayers(prisma: any, tournamentId: string): Promise<string[]> {
  const [enrolled, assigned] = await Promise.all([
    prisma.tournament_players.findMany({
      where: { tournament_id: tournamentId },
      select: { user_id: true },
      orderBy: { created_at: "asc" },
    }),
    prisma.team_members.findMany({
      where: { teams: { tournament_id: tournamentId } },
      select: { user_id: true },
    }),
  ]);
  const assignedSet = new Set(assigned.map((x: { user_id: string }) => x.user_id));
  return enrolled
    .map((x: { user_id: string }) => x.user_id)
    .filter((uid: string) => !assignedSet.has(uid));
}

async function createPick(
  prisma: any,
  args: {
    tournamentId: string;
    captainId: string;
    round: number;
    pickIndex: number;
    pickedUserId: string | null;
    skipped: boolean;
  }
) {
  const captainTeam = await prisma.teams.findFirst({
    where: { tournament_id: args.tournamentId, captain_user_id: args.captainId },
    include: { team_members: { select: { id: true } } },
  });
  if (!captainTeam) return;

  const canAssign = !args.skipped && args.pickedUserId && captainTeam.team_members.length < TEAM_SIZE;
  if (canAssign) {
    const nextRole = ROLES_ORDER[captainTeam.team_members.length];
    if (!nextRole) return;
    await prisma.team_members.create({
      data: {
        team_id: captainTeam.id,
        user_id: args.pickedUserId!,
        assigned_role: nextRole,
      },
    });
  }

  await prisma.draft_picks.create({
    data: {
      tournament_id: args.tournamentId,
      round: args.round,
      pick_index: args.pickIndex,
      captain_user_id: args.captainId,
      picked_user_id: canAssign ? args.pickedUserId : null,
      skipped: !canAssign,
      team_id: captainTeam.id,
    },
  });
}

async function processExpiredDraftTurns(prisma: any, tournamentId: string) {
  const t = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: {
      draft_state: true,
      team_formation_mode: true,
      draft_captain_order: true,
      draft_pick_timeout_sec: true,
      draft_timeout_policy: true,
      draft_turn_started_at: true,
    },
  });
  if (!t) return;
  if (t.team_formation_mode !== team_formation_mode.CAPTAIN_DRAFT) return;
  if (t.draft_state !== draft_state.IN_PROGRESS) return;
  if (!t.draft_turn_started_at) return;
  const order = t.draft_captain_order;
  if (order.length === 0) return;

  const totalNeededPicks = order.length * (TEAM_SIZE - 1);

  for (let i = 0; i < totalNeededPicks; i++) {
    const done = await prisma.draft_picks.count({ where: { tournament_id: tournamentId } });
    if (done >= totalNeededPicks) break;

    const turnStarted = await prisma.tournaments.findUnique({
      where: { id: tournamentId },
      select: { draft_turn_started_at: true, draft_pick_timeout_sec: true, draft_timeout_policy: true },
    });
    if (!turnStarted?.draft_turn_started_at) break;
    const elapsedSec = (Date.now() - turnStarted.draft_turn_started_at.getTime()) / 1000;
    if (elapsedSec < turnStarted.draft_pick_timeout_sec) break;

    const { round, captainTurnId } = currentTurn(order, done);

    const available = await getAvailablePlayers(prisma, tournamentId);
    const autoPickId =
      turnStarted.draft_timeout_policy === draft_timeout_policy.AUTO_PICK && available.length > 0
        ? shuffled(available)[0]
        : null;

    await prisma.$transaction(async (tx: any) => {
      await createPick(tx, {
        tournamentId,
        captainId: captainTurnId,
        round,
        pickIndex: done + 1,
        pickedUserId: autoPickId,
        skipped: !autoPickId,
      });
      if (done + 1 >= totalNeededPicks) {
        await tx.tournaments.update({
          where: { id: tournamentId },
          data: {
            draft_state: draft_state.COMPLETED,
            draft_turn_started_at: null,
          },
        });
      } else {
        await tx.tournaments.update({
          where: { id: tournamentId },
          data: { draft_turn_started_at: new Date() },
        });
      }
    });
  }
}

async function requireUserId() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function startCaptainDraft(
  _prev: CaptainDraftState,
  formData: FormData
): Promise<CaptainDraftState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };
  const orderMode = (formData.get("order_mode") as string)?.trim() || "RANDOM";
  const timeoutRaw = Number((formData.get("draft_pick_timeout_sec") as string)?.trim() || "60");
  const timeoutSec = Number.isFinite(timeoutRaw) ? Math.max(10, Math.min(300, Math.floor(timeoutRaw))) : 60;
  const policyRaw = (formData.get("draft_timeout_policy") as string)?.trim();
  const timeoutPolicy =
    policyRaw === draft_timeout_policy.SKIP_TURN ? draft_timeout_policy.SKIP_TURN : draft_timeout_policy.AUTO_PICK;

  const userId = await requireUserId();
  if (!userId) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const org = await assertTournamentOrganizer(prisma, tournamentId, userId);
  if (!org.ok) return { error: org.error };

  const tournament = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: { team_formation_mode: true, status: true },
  });
  if (!tournament) return { error: "Torneio não encontrado." };
  if (tournament.team_formation_mode !== team_formation_mode.CAPTAIN_DRAFT) {
    return { error: "Este torneio não está no modo Draft por Capitães." };
  }
  if (tournament.status === tournament_status.FINISHED) {
    return { error: "Torneio finalizado não pode reiniciar draft." };
  }

  const players = await prisma.tournament_players.findMany({
    where: { tournament_id: tournamentId },
    select: { user_id: true },
    orderBy: { created_at: "asc" },
  });
  const n = players.length;
  if (n < TEAM_SIZE || n % TEAM_SIZE !== 0) {
    return {
      error: `É necessário número de inscritos divisível por ${TEAM_SIZE} (atualmente: ${n}).`,
    };
  }

  const teamCount = n / TEAM_SIZE;
  const allUserIds = players.map((p) => p.user_id);
  let captainOrder: string[] = [];
  if (orderMode === "MANUAL") {
    for (let i = 0; i < teamCount; i++) {
      const uid = (formData.get(`captain_${i}`) as string)?.trim();
      if (!uid) return { error: "Selecione todos os capitães na ordem manual." };
      captainOrder.push(uid);
    }
    if (new Set(captainOrder).size !== captainOrder.length) {
      return { error: "Capitães repetidos na ordem manual." };
    }
    for (const uid of captainOrder) {
      if (!allUserIds.includes(uid)) return { error: "Capitão inválido (não inscrito)." };
    }
  } else {
    captainOrder = shuffled(allUserIds).slice(0, teamCount);
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      await tx.tournament_results.updateMany({
        where: { tournament_id: tournamentId },
        data: {
          champion_team_id: null,
          runner_up_team_id: null,
          tournament_mvp_user_id: null,
        },
      });
      await tx.matches.deleteMany({ where: { tournament_id: tournamentId } });
      await tx.draft_picks.deleteMany({ where: { tournament_id: tournamentId } });
      await tx.teams.deleteMany({ where: { tournament_id: tournamentId } });

      for (let i = 0; i < captainOrder.length; i++) {
        const captainId = captainOrder[i];
        const team = await tx.teams.create({
          data: {
            tournament_id: tournamentId,
            name: `Time ${i + 1}`,
            captain_user_id: captainId,
          },
        });
        await tx.team_members.create({
          data: {
            team_id: team.id,
            user_id: captainId,
            assigned_role: ROLES_ORDER[0],
          },
        });
      }

      await tx.tournaments.update({
        where: { id: tournamentId },
        data: {
          draft_state: draft_state.IN_PROGRESS,
          draft_captain_order: captainOrder,
          draft_pick_timeout_sec: timeoutSec,
          draft_timeout_policy: timeoutPolicy,
          draft_turn_started_at: new Date(),
          status: tournament_status.OPEN,
        },
      });
    });
  } catch (e) {
    console.error(e);
    return { error: "Erro ao iniciar draft dos capitães." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/draft`);
  revalidatePath(`/tournaments/${tournamentId}/chaveamento`);
  return { success: true };
}

export async function makeCaptainDraftPick(
  _prev: CaptainDraftState,
  formData: FormData
): Promise<CaptainDraftState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  const pickedUserId = (formData.get("picked_user_id") as string)?.trim();
  if (!tournamentId || !pickedUserId) return { error: "Dados inválidos." };

  const userId = await requireUserId();
  if (!userId) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  await processExpiredDraftTurns(prisma, tournamentId);
  const tournament = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      draft_state: true,
      draft_captain_order: true,
      team_formation_mode: true,
      draft_turn_started_at: true,
    },
  });
  if (!tournament) return { error: "Torneio não encontrado." };
  if (tournament.team_formation_mode !== team_formation_mode.CAPTAIN_DRAFT) {
    return { error: "Este torneio não está no modo Draft por Capitães." };
  }
  if (tournament.draft_state !== draft_state.IN_PROGRESS) {
    return { error: "Draft não está em andamento." };
  }

  const order = tournament.draft_captain_order;
  const teamCount = order.length;
  if (teamCount === 0) return { error: "Ordem de capitães ausente." };

  const totalNeededPicks = teamCount * (TEAM_SIZE - 1);
  const done = await prisma.draft_picks.count({ where: { tournament_id: tournamentId } });
  if (done >= totalNeededPicks) {
    return { error: "Draft já foi concluído." };
  }

  const round = Math.floor(done / teamCount) + 1;
  const pos = done % teamCount;
  const captainTurnId = round % 2 === 1 ? order[pos] : order[teamCount - 1 - pos];
  if (captainTurnId !== userId) {
    return { error: "Não é a tua vez de escolher." };
  }

  const captainTeam = await prisma.teams.findFirst({
    where: { tournament_id: tournamentId, captain_user_id: userId },
    include: { team_members: { select: { id: true } } },
  });
  if (!captainTeam) return { error: "Time do capitão não encontrado." };
  if (captainTeam.team_members.length >= TEAM_SIZE) {
    return { error: "O teu time já está completo." };
  }

  const enrolled = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: { tournament_id: tournamentId, user_id: pickedUserId },
    },
  });
  if (!enrolled) return { error: "Jogador não inscrito neste torneio." };

  const alreadyAssigned = await prisma.team_members.findFirst({
    where: { user_id: pickedUserId, teams: { tournament_id: tournamentId } },
  });
  if (alreadyAssigned) return { error: "Jogador já foi escolhido." };

  try {
    await prisma.$transaction(async (tx: any) => {
      await createPick(tx, {
        tournamentId,
        captainId: userId,
        round,
        pickIndex: done + 1,
        pickedUserId,
        skipped: false,
      });

      if (done + 1 >= totalNeededPicks) {
        await tx.tournaments.update({
          where: { id: tournamentId },
          data: {
            draft_state: draft_state.COMPLETED,
            draft_turn_started_at: null,
          },
        });
      } else {
        await tx.tournaments.update({
          where: { id: tournamentId },
          data: { draft_turn_started_at: new Date() },
        });
      }
    });
  } catch (e) {
    console.error(e);
    return { error: "Erro ao registar pick do draft." };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/draft`);
  return { success: true };
}

export async function processDraftTimeoutsAction(tournamentId: string): Promise<CaptainDraftState> {
  const tid = tournamentId.trim();
  if (!tid) return { error: "Torneio inválido." };
  const prisma = getPrisma();
  await processExpiredDraftTurns(prisma, tid);
  revalidatePath(`/tournaments/${tid}/draft`);
  revalidatePath(`/tournaments/${tid}`);
  return { success: true };
}

