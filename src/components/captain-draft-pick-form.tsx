"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CaptainDraftState } from "@/app/actions/captain-draft";
import { makeCaptainDraftPick } from "@/app/actions/captain-draft";

type PlayerOption = { userId: string; nickname: string };

export function CaptainDraftPickForm({
  tournamentId,
  available,
}: {
  tournamentId: string;
  available: PlayerOption[];
}) {
  const [state, formAction, pending] = useActionState(makeCaptainDraftPick, null as CaptainDraftState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  if (available.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <label className="block text-xs font-medium uppercase text-tm-muted">Escolher jogador</label>
      <select
        name="picked_user_id"
        required
        defaultValue=""
        className="w-full max-w-md rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
      >
        <option value="" disabled>
          — selecionar —
        </option>
        {available.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.nickname}
          </option>
        ))}
      </select>
      {state?.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-cyan px-4 py-2 text-sm font-semibold text-[#0b0e1b] hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A escolher…" : "Confirmar pick"}
      </button>
    </form>
  );
}

