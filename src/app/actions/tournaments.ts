"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { draft_state, team_formation_mode, tournament_format, tournament_status } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { assertTournamentOrganizer } from "@/lib/server-permissions";
import { createClient } from "@/utils/supabase/server";

export type TournamentActionState = {
  error?: string;
  success?: boolean;
} | null;

export type JoinTournamentState = { error?: string } | null;

export type DeleteTournamentState = { error?: string } | null;

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomInviteCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return s;
}

export async function createTournament(
  _prev: TournamentActionState,
  formData: FormData
): Promise<TournamentActionState> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Você precisa estar logado." };
  }

  const name = (formData.get("name") as string)?.trim();
  const startRaw = formData.get("start_date") as string;
  const formationRaw = (formData.get("team_formation_mode") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "Informe um nome com pelo menos 2 caracteres." };
  }
  if (!startRaw) {
    return { error: "Informe a data de início." };
  }
  const formationMode =
    formationRaw === team_formation_mode.CAPTAIN_DRAFT
      ? team_formation_mode.CAPTAIN_DRAFT
      : team_formation_mode.ALGORITHM;

  const startDate = new Date(startRaw + "T12:00:00.000Z");
  if (Number.isNaN(startDate.getTime())) {
    return { error: "Data inválida." };
  }

  const prisma = getPrisma();
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const invite_code = randomInviteCode();
    try {
      await prisma.tournaments.create({
        data: {
          name,
          invite_code,
          start_date: startDate,
          users: {
            connect: { id: user.id },
          },
          format: tournament_format.SINGLE_ELIMINATION,
          team_formation_mode: formationMode,
          draft_state: draft_state.PENDING,
          status: tournament_status.OPEN,
        },
      });
      revalidatePath("/tournaments");
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = msg;
      if (msg.includes("Unique constraint") || msg.includes("invite_code")) {
        continue;
      }
      return { error: `Não foi possível criar: ${msg}` };
    }
  }
  return { error: lastErr ?? "Código de convite em conflito. Tente novamente." };
}

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function joinTournamentByCode(
  _prev: JoinTournamentState,
  formData: FormData
): Promise<JoinTournamentState> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Você precisa estar logado." };
  }

  const code = normalizeInviteCode((formData.get("code") as string) ?? "");
  if (code.length < 4) {
    return { error: "Informe um código de convite válido." };
  }

  const prisma = getPrisma();
  const tournament = await prisma.tournaments.findUnique({
    where: { invite_code: code },
  });

  if (!tournament) {
    return { error: "Não encontramos nenhum torneio com esse código." };
  }
  if (
    tournament.team_formation_mode === team_formation_mode.CAPTAIN_DRAFT &&
    tournament.draft_state !== draft_state.PENDING
  ) {
    return { error: "Este torneio já iniciou o draft por capitães e não aceita novas inscrições." };
  }

  const already = await prisma.tournament_players.findFirst({
    where: {
      tournament_id: tournament.id,
      user_id: user.id,
    },
  });

  if (already) {
    revalidatePath("/tournaments");
    revalidatePath("/");
    redirect(`/tournaments/${tournament.id}`);
  }

  const playerCount = await prisma.tournament_players.count({
    where: { tournament_id: tournament.id },
  });
  if (playerCount >= 20) {
    return { error: "Este torneio já tem 20 jogadores (limite)." };
  }

  try {
    await prisma.tournament_players.create({
      data: {
        tournament_id: tournament.id,
        user_id: user.id,
        preferred_roles: [],
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique") || msg.includes("duplicate")) {
      redirect(`/tournaments/${tournament.id}`);
    }
    return { error: `Não foi possível entrar: ${msg}` };
  }

  revalidatePath("/tournaments");
  revalidatePath("/");
  redirect(`/tournaments/${tournament.id}`);
}

/**
 * Apaga o torneio e dados associados (CASCADE no Postgres).
 * Só o organizador; exige confirmação no formulário (`confirm_delete`).
 */
export async function deleteTournament(
  _prev: DeleteTournamentState,
  formData: FormData
): Promise<DeleteTournamentState> {
  const tournamentId = (formData.get("tournament_id") as string)?.trim();
  if (!tournamentId) return { error: "Torneio inválido." };

  const confirm = formData.get("confirm_delete");
  if (confirm !== "yes") {
    return { error: "É necessário confirmar que pretendes excluir o torneio." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Você precisa estar logado." };

  const prisma = getPrisma();
  const org = await assertTournamentOrganizer(prisma, tournamentId, user.id);
  if (!org.ok) return { error: org.error };

  try {
    await prisma.tournaments.delete({
      where: { id: tournamentId },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(e);
    return { error: `Não foi possível excluir: ${msg}` };
  }

  revalidatePath("/tournaments");
  revalidatePath("/");
  redirect("/tournaments");
}
