import type { PrismaClient } from "@/generated/prisma/client";

/** Médias das notas que outros deram a cada jogador, por lane (0 se não houver votos na lane). */
export type PeerLaneAverages = {
  rating_top: number;
  rating_jungle: number;
  rating_mid: number;
  rating_adc: number;
  rating_support: number;
};

type Agg = { sum: number; count: number };

function emptyAgg(): Record<keyof PeerLaneAverages, Agg> {
  return {
    rating_top: { sum: 0, count: 0 },
    rating_jungle: { sum: 0, count: 0 },
    rating_mid: { sum: 0, count: 0 },
    rating_adc: { sum: 0, count: 0 },
    rating_support: { sum: 0, count: 0 },
  };
}

function avg(a: Agg): number {
  return a.count > 0 ? a.sum / a.count : 0;
}

/**
 * Agrega `tournament_peer_ratings` por `rated_id` e coluna de lane (só scores não nulos).
 */
export async function getPeerLaneAveragesForTournament(
  prisma: PrismaClient,
  tournamentId: string
): Promise<Map<string, PeerLaneAverages>> {
  const rows = await prisma.tournament_peer_ratings.findMany({
    where: { tournament_id: tournamentId },
    select: {
      rated_id: true,
      score_top: true,
      score_jungle: true,
      score_mid: true,
      score_adc: true,
      score_support: true,
    },
  });

  const byUser = new Map<string, ReturnType<typeof emptyAgg>>();

  for (const row of rows) {
    const uid = row.rated_id;
    if (!byUser.has(uid)) {
      byUser.set(uid, emptyAgg());
    }
    const b = byUser.get(uid)!;
    if (row.score_top != null) {
      b.rating_top.sum += Number(row.score_top);
      b.rating_top.count += 1;
    }
    if (row.score_jungle != null) {
      b.rating_jungle.sum += Number(row.score_jungle);
      b.rating_jungle.count += 1;
    }
    if (row.score_mid != null) {
      b.rating_mid.sum += Number(row.score_mid);
      b.rating_mid.count += 1;
    }
    if (row.score_adc != null) {
      b.rating_adc.sum += Number(row.score_adc);
      b.rating_adc.count += 1;
    }
    if (row.score_support != null) {
      b.rating_support.sum += Number(row.score_support);
      b.rating_support.count += 1;
    }
  }

  const out = new Map<string, PeerLaneAverages>();
  for (const [uid, b] of byUser) {
    out.set(uid, {
      rating_top: avg(b.rating_top),
      rating_jungle: avg(b.rating_jungle),
      rating_mid: avg(b.rating_mid),
      rating_adc: avg(b.rating_adc),
      rating_support: avg(b.rating_support),
    });
  }
  return out;
}
