import Image from "next/image";
import type { role_type } from "@/generated/prisma/enums";

export type PeerLaneAvg = {
  lane: role_type;
  label: string;
  avgScore: number | null;
  votes: number;
};

export type PeerAverageVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  lanes: PeerLaneAvg[];
};

export function PeerRatingsAverages({ rows }: { rows: PeerAverageVM[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-tm-muted">Ainda não há notas agregadas (todos em branco).</p>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li
          key={r.userId}
          className="rounded-2xl border border-white/5 bg-tm-surface/80 px-4 py-3"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10">
              {r.avatarUrl ? (
                <Image src={r.avatarUrl} alt="" fill className="object-cover" sizes="40px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/40 text-xs font-bold text-tm-cyan">
                  {r.nickname.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <p className="font-medium text-white">{r.nickname}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {r.lanes.map((lane) => (
              <div key={lane.lane} className="text-center">
                <p className="text-xs text-tm-muted">{lane.label}</p>
                <p className="text-lg font-bold text-tm-cyan">
                  {lane.avgScore != null ? lane.avgScore.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-tm-muted">{lane.votes} votos</p>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
