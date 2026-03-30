"use server";

import { Prisma } from "@/generated/prisma/client";
import { role_type } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { assertTournamentOrganizer } from "@/lib/server-permissions";
import { createClient } from "@/utils/supabase/server";

export type PeerRatingsState = { error?: string; success?: boolean } | null;

const PEER_LANE_FIELDS = [
  { role: role_type.TOP, field: "score_top" as const },
  { role: role_type.JUNGLE, field: "score_jungle" as const },
  { role: role_type.MID, field: "score_mid" as const },
  { role: role_type.ADC, field: "score_adc" as const },
  { role: role_type.SUPPORT, field: "score_support" as const },
] as const;

function parseScore(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

function scoresFromForm(
  formData: FormData,
  ratedId: string,
  allowedRoles: readonly role_type[],
) {
  const allowed = new Set(allowedRoles);
  const s = {
    score_top: null as Prisma.Decimal | null,
    score_jungle: null as Prisma.Decimal | null,
    score_mid: null as Prisma.Decimal | null,
    score_adc: null as Prisma.Decimal | null,
    score_support: null as Prisma.Decimal | null,
  };
  for (const { role, field } of PEER_LANE_FIELDS) {
    if (!allowed.has(role)) {
      s[field] = null;
      continue;
    }
    const raw = formData.get(`score_${ratedId}_${role}`) as string | null;
    const n = parseScore(raw);
    s[field] = n === null ? null : new Prisma.Decimal(n);
  }
  return s;
}

export async function savePeerRatings(
  _prev: PeerRatingsState,
  formData: FormData
): Promise<PeerRatingsState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const tournament = await prisma.tournaments.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) return { error: "Torneio não encontrado." };
  if (!tournament.peer_ratings_open) {
    return { error: "O período de avaliações já foi fechado pelo organizador." };
  }

  const me = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: {
        tournament_id: tournamentId,
        user_id: user.id,
      },
    },
  });
  if (!me) {
    return { error: "Só jogadores inscritos podem avaliar." };
  }

  const players = await prisma.tournament_players.findMany({
    where: { tournament_id: tournamentId },
    select: { user_id: true, preferred_roles: true },
  });
  const rolesByUser = new Map(
    players.map((p) => [p.user_id, p.preferred_roles ?? []]),
  );
  const otherIds = players.map((p) => p.user_id).filter((id) => id !== user.id);

  const ops = otherIds.map((ratedId) => {
    const allowedRoles = rolesByUser.get(ratedId) ?? [];
    const s = scoresFromForm(formData, ratedId, allowedRoles);
    return prisma.tournament_peer_ratings.upsert({
      where: {
        tournament_id_rater_id_rated_id: {
          tournament_id: tournamentId,
          rater_id: user.id,
          rated_id: ratedId,
        },
      },
      create: {
        tournament_id: tournamentId,
        rater_id: user.id,
        rated_id: ratedId,
        ...s,
      },
      update: { ...s },
    });
  });

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  revalidatePath(`/tournaments/${tournamentId}/avaliacoes`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function closePeerRatingsFormAction(formData: FormData) {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return;
  await closePeerRatingsPeriod(tournamentId);
}

export async function closePeerRatingsPeriod(tournamentId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const prisma = getPrisma();
  const check = await assertTournamentOrganizer(prisma, tournamentId, user.id);
  if (!check.ok) return;

  await prisma.tournaments.update({
    where: { id: tournamentId },
    data: { peer_ratings_open: false },
  });

  revalidatePath(`/tournaments/${tournamentId}/avaliacoes`);
  revalidatePath(`/tournaments/${tournamentId}`);
}
