import { role_type } from "@/generated/prisma/enums";

export const ROLE_TO_PEER_SCORE_FIELD = {
  [role_type.TOP]: "score_top",
  [role_type.JUNGLE]: "score_jungle",
  [role_type.MID]: "score_mid",
  [role_type.ADC]: "score_adc",
  [role_type.SUPPORT]: "score_support",
} as const;

type Row = {
  score_top: unknown;
  score_jungle: unknown;
  score_mid: unknown;
  score_adc: unknown;
  score_support: unknown;
};

export function peerScoreForLane(row: Row, role: role_type): number | null {
  const key = ROLE_TO_PEER_SCORE_FIELD[role];
  const v = row[key as keyof Row];
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
