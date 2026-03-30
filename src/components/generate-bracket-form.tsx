"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BracketActionState } from "@/app/actions/bracket";
import { generateBracket } from "@/app/actions/bracket";

export function GenerateBracketForm({
  tournamentId,
  disabled,
  disabledReason,
}: {
  tournamentId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(generateBracket, null as BracketActionState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  if (disabled) {
    return <p className="text-sm text-tm-muted">{disabledReason ?? "Não disponível."}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-xs text-tm-muted">
        Cria todas as partidas de eliminação simples (potência de 2 de times). A primeira rodada emparelha os
        times pela ordem de criação. Partidas seguintes preenchem automaticamente quando registas o vencedor.
        <strong className="text-white"> Partidas anteriores deste torneio são apagadas.</strong>
      </p>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Chaveamento gerado.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-purple px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A gerar…" : "Gerar chaveamento"}
      </button>
    </form>
  );
}
