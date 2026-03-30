"use client";

import { useActionState } from "react";
import type { DeleteTournamentState } from "@/app/actions/tournaments";
import { deleteTournament } from "@/app/actions/tournaments";

export function DeleteTournamentForm({ tournamentId }: { tournamentId: string }) {
  const [state, formAction, pending] = useActionState(deleteTournament, null as DeleteTournamentState);

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(e) => {
        const ok = window.confirm(
          "Excluir este torneio permanentemente? Times, partidas, inscrições e resultados serão apagados. Esta ação não pode ser desfeita."
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <label className="flex cursor-pointer items-start gap-3 text-sm text-tm-muted">
        <input
          type="checkbox"
          name="confirm_delete"
          value="yes"
          required
          className="mt-1 h-4 w-4 rounded border-white/20 text-red-400 focus:ring-red-400/50"
        />
        <span>
          Confirmo que quero <strong className="text-white">excluir permanentemente</strong> este torneio e
          todos os dados associados (inscrições, times, chaveamento, partidas, votos MVP, etc.).
        </span>
      </label>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        {pending ? "A excluir…" : "Excluir torneio"}
      </button>
    </form>
  );
}
