import Image from "next/image";
import type { LanePeerStatVM } from "@/lib/build-lane-peer-stats";
import { PeerLaneDetailDialog } from "@/components/peer-lane-detail-dialog";

export type RegisteredPlayerVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  preferredRoles: string[];
  /** Médias e votos por lane (alinhado às lanes preferidas) */
  laneStats: LanePeerStatVM[];
};

export function RegisteredPlayersList({ players }: { players: RegisteredPlayerVM[] }) {
  if (players.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-tm-muted">
        Ainda não há inscritos neste torneio.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {players.map((p) => (
        <li
          key={p.userId}
          className="flex gap-4 rounded-2xl border border-white/5 bg-tm-surface/90 p-4"
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/30">
            {p.avatarUrl ? (
              <Image
                src={p.avatarUrl}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-tm-cyan">
                {p.nickname.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">{p.nickname}</p>
            <div className="mt-1 text-xs text-tm-muted">
              Lanes no torneio (até 3):{" "}
              {p.laneStats.length === 0 ? (
                <span className="text-tm-cyan">—</span>
              ) : (
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
                  {p.laneStats.map((ls, i) => (
                    <span key={ls.role} className="inline-flex items-center">
                      {i > 0 ? " · " : ""}
                      <PeerLaneDetailDialog
                        laneLabel={ls.label}
                        avg={ls.avg}
                        votes={ls.votes}
                      />
                    </span>
                  ))}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-tm-muted">
              Notas por lane vêm das avaliações entre jogadores (não há auto-nota). Clica numa lane para
              ver quem avaliou e quanto deu.
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
