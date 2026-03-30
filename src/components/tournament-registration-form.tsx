"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistrationState } from "@/app/actions/tournament-registration";
import { LANE_OPTIONS } from "@/lib/lanes";
import { role_type } from "@/generated/prisma/enums";

type Initial = {
  preferred_roles: string[];
};

function initialSelectedLanes(initial: Initial): Set<role_type> {
  const raw = initial.preferred_roles ?? [];
  const take = raw.length > 3 ? raw.slice(0, 3) : raw;
  const s = new Set<role_type>();
  for (const r of take) {
    if (Object.values(role_type).includes(r as role_type)) {
      s.add(r as role_type);
    }
  }
  if (s.size === 0) {
    s.add(role_type.TOP);
    s.add(role_type.JUNGLE);
    s.add(role_type.MID);
  }
  return s;
}

export function TournamentRegistrationForm({
  tournamentId,
  action,
  initial,
}: {
  tournamentId: string;
  action: (
    prev: RegistrationState,
    formData: FormData
  ) => Promise<RegistrationState>;
  initial: Initial;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  const [selected, setSelected] = useState<Set<role_type>>(() =>
    initialSelectedLanes(initial)
  );

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  const toggleLane = (lane: role_type) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lane)) {
        if (next.size <= 1) return next;
        next.delete(lane);
        return next;
      }
      if (next.size >= 3) return next;
      next.add(lane);
      return next;
    });
  };

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-tm-cyan/20 bg-tm-surface/90 p-6">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-cyan">
        Inscrição — lanes
      </h2>
      <p className="text-xs text-tm-muted">
        Escolha <strong className="text-white">de 1 a 3 lanes</strong> que você joga.{" "}
        <strong className="text-tm-cyan">Você não dá nota a si mesmo</strong> — as notas por lane vêm
        das <strong className="text-white">avaliações entre jogadores</strong> (outros participantes).
        O balanceamento dos times usa essas médias ao gerar times.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-tm-muted">Lanes que você joga (máx. 3)</p>
        <div className="flex flex-wrap gap-2">
          {LANE_OPTIONS.map((o) => {
            const on = selected.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggleLane(o.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  on
                    ? "border-tm-cyan bg-tm-cyan/15 text-tm-cyan"
                    : "border-white/10 text-tm-muted hover:border-white/20"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-tm-muted">
          {selected.size} de 3 selecionada(s). Essas posições entram no algoritmo de times.
        </p>
        {LANE_OPTIONS.map((o) =>
          selected.has(o.value) ? (
            <input key={o.value} type="hidden" name={`lane_${o.value}`} value="1" />
          ) : null
        )}
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Inscrição salva.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/20 hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar inscrição"}
      </button>
    </form>
  );
}
