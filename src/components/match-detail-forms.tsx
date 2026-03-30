"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  setMatchResultAction,
  updateMatchScheduleAction,
  type BracketActionState,
} from "@/app/actions/bracket";

function toDatetimeLocalValue(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchScheduleForm({
  matchId,
  tournamentId,
  matchDateIso,
}: {
  matchId: string;
  tournamentId: string;
  matchDateIso: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BracketActionState>(null);

  const d = matchDateIso ? new Date(matchDateIso) : null;
  const defaultVal = d ? toDatetimeLocalValue(d) : "";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setState(null);
        const fd = new FormData(e.currentTarget);
        const local = (fd.get("when") as string) || "";
        const isoUtc = local.trim() !== "" ? new Date(local).toISOString() : null;
        startTransition(async () => {
          const r = await updateMatchScheduleAction(matchId, tournamentId, isoUtc);
          setState(r);
          router.refresh();
        });
      }}
    >
      <label className="block text-xs font-medium uppercase text-tm-muted">Data e hora da partida</label>
      <input
        name="when"
        type="datetime-local"
        defaultValue={defaultVal}
        className="mt-1 w-full max-w-xs rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
      />
      {state?.error ? (
        <p className="text-sm text-red-300">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-200">Horário guardado.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-cyan px-4 py-2 text-sm font-semibold text-[#0b0e1b] hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A guardar…" : "Guardar horário"}
      </button>
    </form>
  );
}

export function MatchResultForm({
  matchId,
  tournamentId,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  finished,
}: {
  matchId: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  finished: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BracketActionState>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [tieWinner, setTieWinner] = useState("");
  const isTie = scoreA === scoreB;

  useEffect(() => {
    if (!isTie) setTieWinner("");
  }, [isTie]);

  if (finished) {
    return (
      <p className="text-sm text-tm-muted">
        Esta partida está concluída. O resultado não pode ser alterado aqui.
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setState(null);
        startTransition(async () => {
          const r = await setMatchResultAction(
            matchId,
            tournamentId,
            scoreA,
            scoreB,
            isTie ? tieWinner || null : null
          );
          setState(r);
          router.refresh();
        });
      }}
    >
      <p className="text-xs text-tm-muted">
        O vencedor é definido automaticamente pelo placar (maior pontuação). Se empatarem, escolhe quem
        avança (ex.: WO ou decisão do organizador).
      </p>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase text-tm-muted">{teamAName}</label>
          <input
            type="number"
            min={0}
            value={scoreA}
            onChange={(e) => setScoreA(Number.parseInt(e.target.value, 10) || 0)}
            required
            className="mt-1 w-full rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-tm-muted">{teamBName}</label>
          <input
            type="number"
            min={0}
            value={scoreB}
            onChange={(e) => setScoreB(Number.parseInt(e.target.value, 10) || 0)}
            required
            className="mt-1 w-full rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
          />
        </div>
      </div>
      {isTie ? (
        <div>
          <label className="text-xs uppercase text-tm-muted">Vencedor em caso de empate</label>
          <select
            value={tieWinner}
            onChange={(e) => setTieWinner(e.target.value)}
            required
            className="mt-1 w-full max-w-md rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white"
          >
            <option value="">— Escolher —</option>
            <option value={teamAId}>{teamAName}</option>
            <option value={teamBId}>{teamBName}</option>
          </select>
        </div>
      ) : null}
      {state?.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      {state?.success ? (
        <p className="text-sm text-emerald-200">
          Resultado registado (PENDING → FINISHED). O vencedor entrou na partida seguinte do chaveamento.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-tm-purple px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "A guardar…" : "Registar resultado"}
      </button>
    </form>
  );
}
