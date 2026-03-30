import { draft_state, tournament_status } from "@/generated/prisma/client";

export function leaveTournamentBlockedReason(input: {
  status: tournament_status | null | undefined;
  teamsCount: number;
  draftState: draft_state | null | undefined;
  matchCount: number;
}): string | null {
  if (input.status === tournament_status.FINISHED) {
    return "Torneio já finalizado — não é possível sair.";
  }
  if (input.teamsCount > 0) {
    return "Já existem times neste torneio. Não é possível sair automaticamente — fale com o organizador.";
  }
  if (input.draftState !== draft_state.PENDING) {
    return "O draft já foi iniciado ou concluído — não é possível sair.";
  }
  if (input.matchCount > 0) {
    return "Já existem partidas no chaveamento — não é possível sair.";
  }
  return null;
}
