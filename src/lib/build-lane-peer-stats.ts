import { role_type } from "@/generated/prisma/enums";
import { roleLabel } from "@/lib/lanes";
import { peerScoreForLane } from "@/lib/peer-rating-lane";

export type PeerVoteVM = {
  raterNickname: string;
  score: number;
};

export type LanePeerStatVM = {
  role: role_type;
  label: string;
  avg: number | null;
  votes: PeerVoteVM[];
};

type RatingRow = {
  rated_id: string;
  rater_id: string;
  score_top: unknown;
  score_jungle: unknown;
  score_mid: unknown;
  score_adc: unknown;
  score_support: unknown;
  rater: {
    profiles: { nickname: string } | null;
  } | null;
};

export function buildLanePeerStatsForPlayer(
  ratedId: string,
  preferredRoles: role_type[],
  allRatings: RatingRow[],
): LanePeerStatVM[] {
  const roles = preferredRoles.slice(0, 3);
  return roles.map((role) => {
    const votes: PeerVoteVM[] = [];
    for (const pr of allRatings) {
      if (pr.rated_id !== ratedId) continue;
      const s = peerScoreForLane(pr, role);
      if (s === null) continue;
      votes.push({
        raterNickname: pr.rater?.profiles?.nickname ?? "Jogador",
        score: s,
      });
    }
    votes.sort((a, b) => a.raterNickname.localeCompare(b.raterNickname, "pt-BR"));
    const avg =
      votes.length === 0
        ? null
        : Math.round((votes.reduce((acc, v) => acc + v.score, 0) / votes.length) * 10) / 10;
    return {
      role,
      label: roleLabel(role),
      avg,
      votes,
    };
  });
}
