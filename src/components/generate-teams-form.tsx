"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GenerateTeamsState } from "@/app/actions/generate-teams";
import { generateBalancedTeams } from "@/app/actions/generate-teams";

export function GenerateTeamsForm({
  tournamentId,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    generateBalancedTeams,
    null as GenerateTeamsState
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  if (disabled) {
    return (
      <p className="text-sm text-tm-muted">{disabledReason ?? "Não disponível."}</p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-xs text-tm-muted">
        As notas usadas no balanceamento são as <strong className="text-white">médias das avaliações entre
        jogadores</strong> por lane (quem ainda não recebeu nota entra com 0 nessa lane). Cada um só pode ser
        colocado nas lanes que marcou (até 3). Times e jogos existentes deste torneio são substituídos.
      </p>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Times gerados e salvos.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-cyan px-4 py-2.5 text-sm font-semibold text-[#0b0e1b] hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Gerando…" : "Gerar times balanceados"}
      </button>
    </form>
  );
}
