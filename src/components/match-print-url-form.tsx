"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMatchPrintUrlAction } from "@/app/actions/bracket";

export function MatchPrintUrlForm({
  matchId,
  tournamentId,
  initialUrl,
}: {
  matchId: string;
  tournamentId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const url = ((fd.get("print_url") as string) ?? "").trim();
        startTransition(async () => {
          const r = await updateMatchPrintUrlAction(matchId, tournamentId, url || null);
          if (r?.error) setError(r.error);
          else if (r?.success) {
            setOk(true);
            router.refresh();
          }
        });
      }}
    >
      <label className="text-xs uppercase text-tm-muted">Print / captura (URL)</label>
      <input
        name="print_url"
        type="url"
        defaultValue={initialUrl ?? ""}
        placeholder="https://…"
        className="mt-1 w-full max-w-lg rounded-lg border border-white/15 bg-tm-bg px-3 py-2 text-sm text-white placeholder:text-tm-muted/50"
      />
      <p className="text-xs text-tm-muted">
        Cola o link público da imagem (ex.: Supabase Storage ou Imgur). Aparece no resumo final e no histórico.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-200">Guardado.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
      >
        {pending ? "A guardar…" : "Guardar print"}
      </button>
    </form>
  );
}
