"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PeerVoteVM } from "@/lib/build-lane-peer-stats";

export type { PeerVoteVM };

export function PeerLaneDetailDialog({
  laneLabel,
  avg,
  votes,
}: {
  laneLabel: string;
  avg: number | null;
  votes: PeerVoteVM[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const avgText =
    avg != null ? avg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline rounded-md border border-tm-cyan/30 bg-tm-cyan/10 px-1.5 py-0.5 font-medium text-tm-cyan transition hover:border-tm-cyan/50 hover:bg-tm-cyan/20"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {laneLabel}{" "}
        <span className="text-white/90">
          ({avgText})
        </span>
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0e1b] p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 id={titleId} className="text-lg font-semibold text-white">
                      Notas em {laneLabel}
                    </h3>
                    <p className="mt-1 text-sm text-tm-muted">
                      Média atual:{" "}
                      <span className="font-medium text-tm-cyan">{avgText}</span>
                      {votes.length > 0 ? (
                        <span className="text-tm-muted"> · {votes.length} avaliação(ões)</span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-tm-muted hover:bg-white/10 hover:text-white"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {votes.length === 0 ? (
                  <p className="text-sm text-tm-muted">Ainda não há notas nesta lane.</p>
                ) : (
                  <ul className="space-y-2">
                    {votes.map((v, i) => (
                      <li
                        key={`${v.raterNickname}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-tm-surface/80 px-3 py-2 text-sm"
                      >
                        <span className="truncate text-white">{v.raterNickname}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-tm-cyan">
                          {v.score.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-6 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-tm-muted hover:bg-white/5"
                >
                  Fechar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
