import Image from "next/image";
import { roleLabel } from "@/lib/lanes";

export type RegisteredPlayerVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  preferredRoles: string[];
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
            <p className="mt-1 text-xs text-tm-muted">
              Lanes no torneio (até 3):{" "}
              <span className="text-tm-cyan">
                {p.preferredRoles.length === 0
                  ? "—"
                  : p.preferredRoles.slice(0, 3).map((r, i) => (
                      <span key={`${p.userId}-${r}-${i}`}>
                        {i > 0 ? " · " : ""}
                        {roleLabel(r)}
                      </span>
                    ))}
              </span>
            </p>
            <p className="mt-1 text-xs text-tm-muted">
              Notas por lane vêm das avaliações entre jogadores (não há auto-nota).
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
