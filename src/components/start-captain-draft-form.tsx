"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CaptainDraftState } from "@/app/actions/captain-draft";
import { startCaptainDraft } from "@/app/actions/captain-draft";
import { draft_timeout_policy } from "@/generated/prisma/enums";

type CaptainOption = { userId: string; nickname: string };

export function StartCaptainDraftForm({
  tournamentId,
  captainsPool,
  teamCount,
}: {
  tournamentId: string;
  captainsPool: CaptainOption[];
  teamCount: number;
}) {
  const [state, formAction, pending] = useActionState(startCaptainDraft, null as CaptainDraftState);
  const router = useRouter();
  const [orderMode, setOrderMode] = useState<"RANDOM" | "MANUAL">("RANDOM");
  const [selected, setSelected] = useState<string[]>(() => Array.from({ length: teamCount }, () => ""));
  const selectedSet = useMemo(() => new Set(selected.filter(Boolean)), [selected]);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <div>
        <label className="text-xs font-medium uppercase text-tm-muted">Ordem inicial dos capitães</label>
        <select
          name="order_mode"
          value={orderMode}
          onChange={(e) => setOrderMode(e.target.value === "MANUAL" ? "MANUAL" : "RANDOM")}
          className="mt-1 w-full max-w-sm rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
        >
          <option value="RANDOM">Sorteio aleatório</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>
      {orderMode === "MANUAL" ? (
        <div className="space-y-2">
          <p className="text-xs text-tm-muted">Define C1…CT (ordem da rodada 1).</p>
          {Array.from({ length: teamCount }).map((_, i) => (
            <div key={i}>
              <label className="text-xs uppercase text-tm-muted">Capitão {i + 1}</label>
              <select
                name={`captain_${i}`}
                value={selected[i] ?? ""}
                required
                onChange={(e) => {
                  const v = e.target.value;
                  setSelected((prev) => {
                    const next = [...prev];
                    next[i] = v;
                    return next;
                  });
                }}
                className="mt-1 w-full max-w-sm rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
              >
                <option value="">— escolher —</option>
                {captainsPool.map((p) => {
                  const blocked = selectedSet.has(p.userId) && selected[i] !== p.userId;
                  return (
                    <option key={p.userId} value={p.userId} disabled={blocked}>
                      {p.nickname}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase text-tm-muted">Timer por pick (segundos)</label>
          <input
            type="number"
            name="draft_pick_timeout_sec"
            min={10}
            max={300}
            defaultValue={60}
            className="mt-1 w-full rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-tm-muted">Ao estourar tempo</label>
          <select
            name="draft_timeout_policy"
            defaultValue={draft_timeout_policy.AUTO_PICK}
            className="mt-1 w-full rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
          >
            <option value={draft_timeout_policy.AUTO_PICK}>Auto-pick</option>
            <option value={draft_timeout_policy.SKIP_TURN}>Passar vez</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-tm-muted">
        Cria os times iniciais com os capitães fixos. O draft segue ordem serpente (snake).
      </p>
      {state?.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-purple px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A iniciar…" : "Iniciar draft por capitães"}
      </button>
    </form>
  );
}

