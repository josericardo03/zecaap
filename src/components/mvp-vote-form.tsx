"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MatchMvpVoteState } from "@/app/actions/match-mvp";
import { castMvpVote } from "@/app/actions/match-mvp";

export type MvpVotePlayerOption = {
  userId: string;
  nickname: string;
};

export function MvpVoteForm({
  matchId,
  tournamentId,
  players,
  initialVotedUserId,
}: {
  matchId: string;
  tournamentId: string;
  players: MvpVotePlayerOption[];
  initialVotedUserId: string | null;
}) {
  const [state, formAction, pending] = useActionState(castMvpVote, null as MatchMvpVoteState);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  if (players.length === 0) return null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Escolher MVP</legend>
        {players.map((p) => (
          <label
            key={p.userId}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition hover:border-tm-cyan/30"
          >
            <input
              type="radio"
              name="voted_user_id"
              value={p.userId}
              defaultChecked={initialVotedUserId === p.userId}
              required
              className="h-4 w-4 border-white/20 text-tm-cyan focus:ring-tm-cyan"
            />
            <span className="text-sm font-medium text-white">{p.nickname}</span>
          </label>
        ))}
      </fieldset>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-200">Voto registado. Cada utilizador tem um voto por partida.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-cyan px-4 py-2.5 text-sm font-semibold text-[#0b0e1b] hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A guardar…" : initialVotedUserId ? "Atualizar voto" : "Confirmar voto MVP"}
      </button>
    </form>
  );
}
