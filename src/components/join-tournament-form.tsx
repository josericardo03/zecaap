"use client";

import { useActionState } from "react";
import type { JoinTournamentState } from "@/app/actions/tournaments";

export function JoinTournamentForm({
  action,
}: {
  action: (
    prev: JoinTournamentState,
    formData: FormData
  ) => Promise<JoinTournamentState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
        <span className="flex items-center px-2 text-tm-muted">⌗</span>
        <input
          name="code"
          required
          minLength={4}
          maxLength={16}
          placeholder="Código do torneio"
          autoCapitalize="characters"
          autoComplete="off"
          className="flex-1 bg-transparent text-sm uppercase tracking-wide text-white outline-none placeholder:text-tm-muted"
        />
      </div>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/25 transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar agora"}
      </button>
    </form>
  );
}
