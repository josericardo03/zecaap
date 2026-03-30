/** Número de equipas é potência de 2 e ≥ 2 (eliminação simples sem byes). */
export function isPowerOfTwoTeamCount(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

export function roundLabel(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinal";
  if (fromFinal === 2) return "Quartas de final";
  if (fromFinal === 3) return "Oitavas de final";
  return `Rodada ${round}`;
}
