"use client";

import { useActionState } from "react";
import type { LeaveTournamentState } from "@/app/actions/tournament-registration";
import { leaveTournament } from "@/app/actions/tournament-registration";

export function LeaveTournamentForm({
  tournamentId,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  disabled: boolean;
  disabledReason?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    leaveTournament,
    null as LeaveTournamentState
  );

  if (disabled) {
    return (
      <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-tm-muted">
        {disabledReason ?? "Não é possível sair do torneio neste momento."}
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        const ok = window.confirm(
          "Sair deste torneio? A sua inscrição e as avaliações que deu/recebeu neste torneio serão removidas. Esta ação não pode ser desfeita."
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="tournament_id" value={tournamentId} />
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
      >
        {pending ? "A sair…" : "Sair do torneio"}
      </button>
    </form>
  );
}
