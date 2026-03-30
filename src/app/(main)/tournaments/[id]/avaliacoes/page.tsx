import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import {
  closePeerRatingsFormAction,
  savePeerRatings,
} from "@/app/actions/peer-ratings";
import { getSessionProfile } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  PeerRatingsAverages,
  type PeerAverageVM,
  type PeerLaneAvg,
} from "@/components/peer-ratings-averages";
import {
  PeerRatingsForm,
  type PeerLaneScores,
  type PeerPlayerVM,
} from "@/components/peer-ratings-form";
import { LANE_OPTIONS } from "@/lib/lanes";
import { role_type } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const PEER_SELECT = {
  score_top: true,
  score_jungle: true,
  score_mid: true,
  score_adc: true,
  score_support: true,
} as const;

const LANE_FIELD: { key: keyof typeof PEER_SELECT; lane: role_type }[] = [
  { key: "score_top", lane: role_type.TOP },
  { key: "score_jungle", lane: role_type.JUNGLE },
  { key: "score_mid", lane: role_type.MID },
  { key: "score_adc", lane: role_type.ADC },
  { key: "score_support", lane: role_type.SUPPORT },
];

function initialFromRow(r: {
  score_top: unknown;
  score_jungle: unknown;
  score_mid: unknown;
  score_adc: unknown;
  score_support: unknown;
}): PeerLaneScores {
  const m: PeerLaneScores = {};
  if (r.score_top != null) m[role_type.TOP] = String(r.score_top);
  if (r.score_jungle != null) m[role_type.JUNGLE] = String(r.score_jungle);
  if (r.score_mid != null) m[role_type.MID] = String(r.score_mid);
  if (r.score_adc != null) m[role_type.ADC] = String(r.score_adc);
  if (r.score_support != null) m[role_type.SUPPORT] = String(r.score_support);
  return m;
}

export default async function TournamentPeerRatingsPage({ params }: Props) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const prisma = getPrisma();
  const tournament = await prisma.tournaments.findUnique({
    where: { id },
  });

  if (!tournament) notFound();

  const isCreator = tournament.created_by === session.user.id;
  const myRow = await prisma.tournament_players.findUnique({
    where: {
      tournament_id_user_id: {
        tournament_id: id,
        user_id: session.user.id,
      },
    },
  });

  if (!isCreator && !myRow) notFound();

  const registrations = await prisma.tournament_players.findMany({
    where: { tournament_id: id },
    include: {
      users: { include: { profiles: true } },
    },
    orderBy: { created_at: "asc" },
  });

  const myRatings = await prisma.tournament_peer_ratings.findMany({
    where: { tournament_id: id, rater_id: session.user.id },
  });
  const initialScores: Record<string, PeerLaneScores> = {};
  for (const r of myRatings) {
    initialScores[r.rated_id] = initialFromRow(r);
  }

  const peerPlayers: PeerPlayerVM[] = registrations
    .filter((r) => r.user_id !== session.user.id)
    .map((r) => ({
      userId: r.user_id,
      nickname: r.users.profiles?.nickname ?? "Jogador",
      avatarUrl: r.users.profiles?.avatar_url ?? null,
      preferredRoles: r.preferred_roles ?? [],
    }));

  let averageRows: PeerAverageVM[] = [];
  if (!tournament.peer_ratings_open) {
    const allRatings = await prisma.tournament_peer_ratings.findMany({
      where: { tournament_id: id },
      select: {
        rated_id: true,
        ...PEER_SELECT,
      },
    });

    const agg = new Map<
      string,
      Map<role_type, { sum: number; count: number }>
    >();

    for (const row of allRatings) {
      const uid = row.rated_id;
      if (!agg.has(uid)) {
        agg.set(uid, new Map());
      }
      const perUser = agg.get(uid)!;
      for (const { key, lane } of LANE_FIELD) {
        const v = row[key];
        if (v == null) continue;
        const n = Number(v);
        const cur = perUser.get(lane) ?? { sum: 0, count: 0 };
        cur.sum += n;
        cur.count += 1;
        perUser.set(lane, cur);
      }
    }

    averageRows = registrations.map((r) => {
      const perUser = agg.get(r.user_id);
      const lanes: PeerLaneAvg[] = LANE_OPTIONS.map((o) => {
        const a = perUser?.get(o.value);
        return {
          lane: o.value,
          label: o.label,
          avgScore: a && a.count > 0 ? a.sum / a.count : null,
          votes: a?.count ?? 0,
        };
      });
      return {
        userId: r.user_id,
        nickname: r.users.profiles?.nickname ?? "Jogador",
        avatarUrl: r.users.profiles?.avatar_url ?? null,
        lanes,
      };
    });
    averageRows.sort((x, y) => x.nickname.localeCompare(y.nickname, "pt-BR"));
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-2 text-sm text-tm-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao torneio
      </Link>

      <div className="flex items-start gap-3">
        <Star className="mt-1 h-8 w-8 shrink-0 text-tm-cyan" />
        <div>
          <h1 className="text-2xl font-bold text-white">Avaliações entre jogadores</h1>
          <p className="mt-1 text-sm text-tm-muted">
            {tournament.name} · só nas lanes que cada jogador registrou na inscrição
          </p>
        </div>
      </div>

      {isCreator && tournament.peer_ratings_open ? (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-100/90">
            Como organizador, você pode <strong className="text-white">fechar o período</strong> quando
            todos tiverem preenchido. Depois disso, ninguém altera notas e as médias ficam visíveis abaixo.
          </p>
          <form action={closePeerRatingsFormAction} className="mt-4">
            <input type="hidden" name="tournament_id" value={id} />
            <button
              type="submit"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              Fechar período de avaliações
            </button>
          </form>
        </section>
      ) : null}

      {isCreator && !tournament.peer_ratings_open ? (
        <p className="rounded-lg border border-white/10 bg-tm-surface/80 px-4 py-3 text-sm text-tm-muted">
          Período fechado. As médias abaixo são finais para este torneio.
        </p>
      ) : null}

      {myRow ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
            {tournament.peer_ratings_open ? "Suas notas" : "Preenchimento encerrado"}
          </h2>
          <PeerRatingsForm
            tournamentId={id}
            action={savePeerRatings}
            players={peerPlayers}
            initialScores={initialScores}
            open={tournament.peer_ratings_open}
          />
        </section>
      ) : (
        <p className="text-sm text-tm-muted">
          Só jogadores inscritos preenchem avaliações. Inscreva-se na página do torneio para participar.
        </p>
      )}

      {!tournament.peer_ratings_open ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-tm-muted">
            Médias por jogador e por lane (após fecho)
          </h2>
          <PeerRatingsAverages rows={averageRows} />
        </section>
      ) : (
        <p className="text-sm text-tm-muted">
          As médias agregadas só aparecem depois do organizador fechar o período de avaliações.
        </p>
      )}
    </div>
  );
}
