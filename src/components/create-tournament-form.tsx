"use client";

import { useActionState } from "react";
import type { TournamentActionState } from "@/app/actions/tournaments";
import { team_formation_mode } from "@/generated/prisma/enums";

export function CreateTournamentForm({
  action,
}: {
  action: (
    prev: TournamentActionState,
    formData: FormData
  ) => Promise<TournamentActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
        Novo torneio
      </h2>
      <div>
        <label className="text-xs font-medium uppercase text-tm-muted">Nome</label>
        <input
          name="name"
          required
          minLength={2}
          placeholder="Ex.: Valorant Night Cup"
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-tm-purple/50"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-tm-muted">
          Data de início
        </label>
        <input
          name="start_date"
          type="date"
          required
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-tm-purple/50"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase text-tm-muted">
          Formação dos times
        </label>
        <select
          name="team_formation_mode"
          defaultValue={team_formation_mode.ALGORITHM}
          className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-tm-purple/50"
        >
          <option value={team_formation_mode.ALGORITHM}>Automático (algoritmo)</option>
          <option value={team_formation_mode.CAPTAIN_DRAFT}>Draft por capitães (snake)</option>
        </select>
        <p className="mt-1 text-xs text-tm-muted">
          As avaliações entre jogadores continuam ativas em ambos os modos.
        </p>
      </div>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Torneio criado. O código de convite aparece na lista abaixo.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/20 hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Criando…" : "Criar torneio"}
      </button>
    </form>
  );
}
