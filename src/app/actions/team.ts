"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { assertTeamCaptain, assertTournamentOrganizer } from "@/lib/server-permissions";
import { createClient } from "@/utils/supabase/server";

export type TeamActionState = { error?: string; success?: boolean } | null;

export async function updateTeamDetails(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const teamId = (formData.get("team_id") as string)?.trim();
  if (!teamId) return { error: "Time inválido." };

  const name = (formData.get("name") as string)?.trim();
  const descriptionRaw = (formData.get("description") as string)?.trim();

  if (!name || name.length < 2) {
    return { error: "Informe um nome com pelo menos 2 caracteres." };
  }
  if (name.length > 80) return { error: "Nome muito longo (máx. 80)." };
  if (descriptionRaw && descriptionRaw.length > 500) {
    return { error: "Descrição muito longa (máx. 500)." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const cap = await assertTeamCaptain(prisma, teamId, user.id);
  if (!cap.ok) return { error: cap.error };

  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    select: { tournament_id: true },
  });
  if (!team) return { error: "Time não encontrado." };

  await prisma.teams.update({
    where: { id: teamId },
    data: {
      name,
      description: descriptionRaw ? descriptionRaw : null,
    },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/tournaments/${team.tournament_id}`);
  return { success: true };
}

/** Salva só o logo após upload no cliente (capitão). */
export async function saveTeamLogoUrl(teamId: string, logoUrl: string) {
  const trimmed = logoUrl.trim();
  if (!trimmed) return { error: "URL inválida." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const prisma = getPrisma();
  const cap = await assertTeamCaptain(prisma, teamId, user.id);
  if (!cap.ok) return { error: cap.error };

  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    select: { tournament_id: true },
  });
  if (!team) return { error: "Time não encontrado." };

  await prisma.teams.update({
    where: { id: teamId },
    data: { logo_url: trimmed },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/tournaments/${team.tournament_id}`);
  return { success: true };
}

export async function setTeamCaptainByOrganizer(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const teamId = (formData.get("team_id") as string)?.trim();
  const newCaptainId = (formData.get("captain_user_id") as string)?.trim();
  if (!teamId || !newCaptainId) return { error: "Dados inválidos." };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    include: {
      tournaments: { select: { id: true } },
      team_members: { select: { user_id: true } },
    },
  });
  if (!team) return { error: "Time não encontrado." };

  const org = await assertTournamentOrganizer(prisma, team.tournaments.id, user.id);
  if (!org.ok) return { error: org.error };

  const isMember = team.team_members.some((m) => m.user_id === newCaptainId);
  if (!isMember) {
    return { error: "O novo capitão precisa ser jogador deste time." };
  }

  await prisma.teams.update({
    where: { id: teamId },
    data: { captain_user_id: newCaptainId },
  });

  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/tournaments/${team.tournaments.id}`);
  return { success: true };
}
