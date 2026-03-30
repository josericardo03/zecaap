"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { PeerRatingsState } from "@/app/actions/peer-ratings";
import { LANE_OPTIONS } from "@/lib/lanes";
import type { role_type } from "@/generated/prisma/enums";

export type PeerLaneScores = Partial<Record<role_type, string>>;

export type PeerPlayerVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  /** Lanes que o jogador indicou na inscrição — só estas podem receber nota. */
  preferredRoles: role_type[];
};

export function PeerRatingsForm({
  tournamentId,
  action,
  players,
  initialScores,
  open,
}: {
  tournamentId: string;
  action: (
    prev: PeerRatingsState,
    formData: FormData
  ) => Promise<PeerRatingsState>;
  players: PeerPlayerVM[];
  initialScores: Record<string, PeerLaneScores>;
  open: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  if (players.length === 0) {
    return (
      <p className="text-sm text-tm-muted">
        Ainda não há outros jogadores para avaliar. Convide até 20 jogadores com o código.
      </p>
    );
  }

  if (!open) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        O organizador fechou o período de avaliações. Já não é possível alterar notas.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-xs text-tm-muted">
        Para cada colega, só aparecem as <strong className="text-tm-cyan">lanes que ele registrou</strong> na
        inscrição do torneio. Notas de <strong className="text-white">0 a 100</strong>; deixe em branco se
        não quiser avaliar essa lane.
      </p>
      <ul className="space-y-4">
        {players.map((p) => (
          <li
            key={p.userId}
            className="rounded-2xl border border-white/10 bg-tm-surface/90 p-4"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10">
                {p.avatarUrl ? (
                  <Image
                    src={p.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/40 text-xs font-bold text-tm-cyan">
                    {p.nickname.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="font-medium text-white">{p.nickname}</p>
            </div>
            {p.preferredRoles.length === 0 ? (
              <p className="text-sm text-amber-200/90">
                Este jogador ainda não definiu lanes na inscrição — não é possível avaliar até ele
                guardar de 1 a 3 lanes na página do torneio.
              </p>
            ) : (
              <div
                className={`grid grid-cols-2 gap-3 ${
                  p.preferredRoles.length <= 2
                    ? "sm:grid-cols-2"
                    : p.preferredRoles.length <= 3
                      ? "sm:grid-cols-3"
                      : p.preferredRoles.length <= 4
                        ? "sm:grid-cols-4"
                        : "sm:grid-cols-5"
                }`}
              >
                {LANE_OPTIONS.filter((lane) => p.preferredRoles.includes(lane.value)).map(
                  (lane) => {
                    const init = initialScores[p.userId]?.[lane.value];
                    return (
                      <label key={lane.value} className="flex flex-col gap-1">
                        <span className="text-xs text-tm-muted">{lane.label}</span>
                        <input
                          name={`score_${p.userId}_${lane.value}`}
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          placeholder="—"
                          defaultValue={init ?? ""}
                          className="w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-2 py-2 text-sm text-white"
                        />
                      </label>
                    );
                  },
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Avaliações salvas.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/20 hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar minhas avaliações"}
      </button>
    </form>
  );
}
