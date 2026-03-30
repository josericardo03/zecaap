import Image from "next/image";
import Link from "next/link";
import { roleLabel } from "@/lib/lanes";
import { MvpVoteForm, type MvpVotePlayerOption } from "@/components/mvp-vote-form";

export type MatchMvpPlayerVM = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
  teamName: string;
};

export function MatchMvpSection({
  matchId,
  tournamentId,
  matchFinished,
  players,
  voteCountByUserId,
  mvpWinnerUserIds,
  myVoteUserId,
  canVoteMvp,
}: {
  matchId: string;
  tournamentId: string;
  matchFinished: boolean;
  players: MatchMvpPlayerVM[];
  voteCountByUserId: Record<string, number>;
  mvpWinnerUserIds: string[];
  myVoteUserId: string | null;
  /** Inscrito em `tournament_players` (organizador não inscrito não vota). */
  canVoteMvp: boolean;
}) {
  const totalVotes = Object.values(voteCountByUserId).reduce((a, b) => a + b, 0);
  const voteOptions: MvpVotePlayerOption[] = players.map((p) => ({
    userId: p.userId,
    nickname: p.nickname,
  }));

  return (
    <section className="rounded-2xl border border-white/10 bg-tm-surface/90 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">MVP da partida</h2>
      <p className="mt-2 text-xs text-tm-muted">
        Os jogadores em campo (até 10). Cada <strong className="text-white">jogador inscrito</strong> tem{" "}
        <strong className="text-white">um voto por partida</strong> — o registo é único (podes alterar em quem
        votaste).
      </p>
      <p className="mt-2 text-xs">
        <Link
          href={`/tournaments/${tournamentId}/mvp`}
          className="font-medium text-tm-cyan transition hover:underline"
        >
          Ver ranking MVP do torneio →
        </Link>
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {players.map((p) => {
          const votes = voteCountByUserId[p.userId] ?? 0;
          const isMvp = mvpWinnerUserIds.includes(p.userId);
          return (
            <li
              key={p.userId}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
                isMvp && totalVotes > 0
                  ? "border-tm-cyan/50 bg-tm-cyan/5"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10">
                {p.avatarUrl ? (
                  <Image src={p.avatarUrl} alt="" fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/40 text-sm font-bold text-tm-cyan">
                    {p.nickname.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{p.nickname}</p>
                <p className="truncate text-xs text-tm-muted">
                  {p.teamName} · {roleLabel(p.role)}
                </p>
                <p className="mt-1 text-xs text-tm-cyan">
                  {votes} voto{votes !== 1 ? "s" : ""}
                  {isMvp && totalVotes > 0 ? (
                    <span className="ml-2 font-semibold text-emerald-300">MVP</span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {matchFinished && totalVotes > 0 && mvpWinnerUserIds.length > 0 ? (
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-200">
            {mvpWinnerUserIds.length === 1
              ? "MVP desta partida"
              : "Empate — MVPs desta partida"}
          </p>
          <p className="mt-1 text-emerald-100/90">
            {mvpWinnerUserIds
              .map((id) => players.find((x) => x.userId === id)?.nickname ?? id)
              .join(", ")}
          </p>
        </div>
      ) : null}

      {matchFinished && canVoteMvp ? (
        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 className="text-xs font-semibold uppercase text-tm-muted">O teu voto</h3>
          <div className="mt-3">
            <MvpVoteForm
              matchId={matchId}
              tournamentId={tournamentId}
              players={voteOptions}
              initialVotedUserId={myVoteUserId}
            />
          </div>
        </div>
      ) : null}

      {matchFinished && !canVoteMvp ? (
        <p className="mt-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-tm-muted">
          A votação MVP é só para <strong className="text-white">jogadores inscritos</strong> no torneio (via
          código de convite). O organizador pode ver resultados, mas não vota aqui.
        </p>
      ) : null}

      {!matchFinished ? (
        <p className="mt-6 text-sm text-tm-muted">
          A votação MVP abre quando a partida estiver concluída (FINISHED).
        </p>
      ) : null}
    </section>
  );
}
