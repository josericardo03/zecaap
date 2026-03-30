"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TeamActionState } from "@/app/actions/team";
import { setTeamCaptainByOrganizer } from "@/app/actions/team";

export type CaptainOption = {
  userId: string;
  nickname: string;
};

export function TeamCaptainTransferForm({
  teamId,
  currentCaptainId,
  members,
}: {
  teamId: string;
  currentCaptainId: string | null;
  members: CaptainOption[];
}) {
  const [state, formAction, pending] = useActionState(
    setTeamCaptainByOrganizer,
    null as TeamActionState
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200/90">
        Organizador — trocar capitão
      </h3>
      <p className="mt-1 text-xs text-tm-muted">
        Escolha outro jogador deste time para ser capitão.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="team_id" value={teamId} />
        <div className="flex-1">
          <label className="text-xs text-tm-muted">Novo capitão</label>
          <select
            name="captain_user_id"
            required
            defaultValue={currentCaptainId ?? members[0]?.userId ?? ""}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e1b] px-3 py-2 text-sm text-white"
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.nickname}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Definir capitão"}
        </button>
      </form>
      {state?.error ? (
        <p className="mt-2 text-sm text-red-300">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="mt-2 text-sm text-emerald-200">Capitão atualizado.</p>
      ) : null}
    </div>
  );
}
