"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { role_type } from "@/generated/prisma/enums";
import type { role_type as RoleType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { leaveTournamentBlockedReason } from "@/lib/tournament-leave-eligibility";
import { createClient } from "@/utils/supabase/server";

export type RegistrationState = { error?: string; success?: boolean } | null;

export type LeaveTournamentState = { error?: string } | null;

const ALL_ROLES = Object.values(role_type) as RoleType[];

function selectedLanesFromForm(formData: FormData): RoleType[] {
  const out: RoleType[] = [];
  for (const r of ALL_ROLES) {
    if (formData.get(`lane_${r}`)) {
      out.push(r);
    }
  }
  return out;
}

export async function saveTournamentRegistration(
  _prev: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const row = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: {
        tournament_id: tournamentId,
        user_id: user.id,
      },
    },
  });
  if (!row) {
    return { error: "Primeiro entre no torneio com o código de convite." };
  }

  const prefs = selectedLanesFromForm(formData);
  if (prefs.length < 1 || prefs.length > 3) {
    return { error: "Selecione de 1 a 3 lanes que você joga." };
  }
  if (new Set(prefs).size !== prefs.length) {
    return { error: "Não repita a mesma lane." };
  }

  /** Notas por lane vêm só das avaliações entre jogadores; colunas legadas ficam em 0. */
  const zero = new Prisma.Decimal(0);

  await prisma.tournament_players.update({
    where: {
      tournament_id_user_id: {
        tournament_id: tournamentId,
        user_id: user.id,
      },
    },
    data: {
      preferred_roles: prefs,
      rating_top: zero,
      rating_jungle: zero,
      rating_mid: zero,
      rating_adc: zero,
      rating_support: zero,
    },
  });

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function leaveTournament(
  _prev: LeaveTournamentState,
  formData: FormData
): Promise<LeaveTournamentState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();

  const row = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: {
        tournament_id: tournamentId,
        user_id: user.id,
      },
    },
  });
  if (!row) return { error: "Você não está inscrito neste torneio." };

  const tournament = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
    include: {
      _count: { select: { teams: true } },
    },
  });
  if (!tournament) return { error: "Torneio não encontrado." };

  const matchCount = await prisma.matches.count({ where: { tournament_id: tournamentId } });
  const blocked = leaveTournamentBlockedReason({
    status: tournament.status,
    teamsCount: tournament._count.teams,
    draftState: tournament.draft_state,
    matchCount,
  });
  if (blocked) return { error: blocked };

  await prisma.$transaction([
    prisma.tournament_peer_ratings.deleteMany({
      where: {
        tournament_id: tournamentId,
        OR: [{ rater_id: user.id }, { rated_id: user.id }],
      },
    }),
    prisma.tournament_players.delete({
      where: {
        tournament_id_user_id: {
          tournament_id: tournamentId,
          user_id: user.id,
        },
      },
    }),
  ]);

  revalidatePath("/tournaments");
  revalidatePath(`/tournaments/${tournamentId}`);
  redirect("/tournaments");
}
