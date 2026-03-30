import { role_type } from "@/generated/prisma/enums";

/** Ordem canônica das posições (uma de cada por time). */
export const BALANCE_ROLES: readonly role_type[] = [
  role_type.TOP,
  role_type.JUNGLE,
  role_type.MID,
  role_type.ADC,
  role_type.SUPPORT,
];

export type PlayerForBalance = {
  user_id: string;
  preferred_roles: role_type[] | null | undefined;
  rating_top: unknown;
  rating_jungle: unknown;
  rating_mid: unknown;
  rating_adc: unknown;
  rating_support: unknown;
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Valor efetivo na lane (0–100), ex.: média das avaliações entre pares ao gerar times. */
export function ratingForRole(p: PlayerForBalance, role: role_type): number {
  switch (role) {
    case role_type.TOP:
      return num(p.rating_top);
    case role_type.JUNGLE:
      return num(p.rating_jungle);
    case role_type.MID:
      return num(p.rating_mid);
    case role_type.ADC:
      return num(p.rating_adc);
    case role_type.SUPPORT:
      return num(p.rating_support);
    default:
      return 0;
  }
}

/**
 * Lanes que o jogador aceita jogar no sorteio: 1–3 da inscrição.
 * Legado: se vier vazio, permite qualquer posição; se vier 5, usa só as 3 primeiras.
 */
export function allowedRolesForBalance(p: PlayerForBalance): role_type[] {
  const raw = p.preferred_roles ?? [];
  if (raw.length === 0) {
    return [...BALANCE_ROLES];
  }
  const uniq = [...new Set(raw)];
  if (uniq.length > 3) {
    return uniq.slice(0, 3);
  }
  return uniq;
}

function canPlay(p: PlayerForBalance, role: role_type): boolean {
  return allowedRolesForBalance(p).includes(role);
}

/** Todas as permutações de arr (até 5! = 120). */
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) {
      out.push([arr[i], ...p]);
    }
  }
  return out;
}

type Edge = { to: number; rev: number; cap: number };

function addEdge(g: Edge[][], u: number, v: number, cap: number) {
  g[u].push({ to: v, rev: g[v].length, cap });
  g[v].push({ to: u, rev: g[u].length - 1, cap: 0 });
}

function buildFlowGraph(players: PlayerForBalance[], T: number): {
  g: Edge[][];
  n: number;
  S: number;
  sink: number;
} {
  const n = players.length;
  const S = 0;
  const sink = n + 6;
  const g: Edge[][] = Array.from({ length: sink + 1 }, () => []);

  for (let i = 0; i < n; i++) {
    addEdge(g, S, 1 + i, 1);
    const allowed = allowedRolesForBalance(players[i]);
    for (let ri = 0; ri < BALANCE_ROLES.length; ri++) {
      const r = BALANCE_ROLES[ri];
      if (allowed.includes(r)) {
        addEdge(g, 1 + i, 1 + n + ri, 1);
      }
    }
  }
  for (let ri = 0; ri < 5; ri++) {
    addEdge(g, 1 + n + ri, sink, T);
  }
  return { g, n, S, sink };
}

function runMaxFlow(
  g: Edge[][],
  S: number,
  sink: number
): number {
  const INF = 1e12;
  let flow = 0;
  const dfs = (v: number, f: number, seen: boolean[]): number => {
    if (v === sink) return f;
    seen[v] = true;
    for (const e of g[v]) {
      if (e.cap > 0 && !seen[e.to]) {
        const pushed = dfs(e.to, Math.min(f, e.cap), seen);
        if (pushed > 0) {
          e.cap -= pushed;
          g[e.to][e.rev].cap += pushed;
          return pushed;
        }
      }
    }
    return 0;
  };

  while (true) {
    const seen = new Array<boolean>(g.length).fill(false);
    const pushed = dfs(S, INF, seen);
    if (pushed === 0) break;
    flow += pushed;
  }
  return flow;
}

/**
 * Existe alocação de cada jogador a exatamente uma posição (T jogadores por posição)?
 */
export function isLaneAssignmentFeasible(players: PlayerForBalance[], T: number): boolean {
  const { g, S, sink, n } = buildFlowGraph(players, T);
  return runMaxFlow(g, S, sink) === n;
}

/** Extrai uma atribuição viável jogador → posição após fluxo máximo (aresta saturada). */
function extractRoleAssignmentFromMaxFlow(
  players: PlayerForBalance[],
  T: number
): Map<string, role_type> | null {
  const { g, n, S, sink } = buildFlowGraph(players, T);
  const flow = runMaxFlow(g, S, sink);
  if (flow !== players.length) return null;

  const map = new Map<string, role_type>();
  for (let i = 0; i < n; i++) {
    const uid = players[i].user_id;
    let found: role_type | null = null;
    for (const e of g[1 + i]) {
      if (e.to >= 1 + n && e.to < 1 + n + 5 && e.cap === 0) {
        const ri = e.to - (1 + n);
        found = BALANCE_ROLES[ri];
        break;
      }
    }
    if (found == null) return null;
    map.set(uid, found);
  }
  return map;
}

type TeamAcc = {
  teamIndex: number;
  sum: number;
  members: BalancedMember[];
};

export type BalancedMember = {
  userId: string;
  role: role_type;
  ratingUsed: number;
};

export type BalancedTeamResult = {
  teamIndex: number;
  members: BalancedMember[];
  totalRating: number;
  captainUserId: string;
};

function teamVariance(teams: TeamAcc[]): number {
  const sums = teams.map((t) => t.sum);
  const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
  return sums.reduce((a, s) => a + (s - mean) ** 2, 0) / sums.length;
}

function totalRatingSum(teams: TeamAcc[]): number {
  return teams.reduce((a, t) => a + t.sum, 0);
}

function cloneTeams(teams: TeamAcc[]): TeamAcc[] {
  return teams.map((t) => ({
    teamIndex: t.teamIndex,
    sum: t.sum,
    members: t.members.map((m) => ({ ...m })),
  }));
}

/**
 * Greedy: para cada posição na ordem dada, T vezes coloca o melhor rating elegível no time mais fraco.
 */
function greedyAssign(
  players: PlayerForBalance[],
  roleOrder: role_type[],
  byId: Map<string, PlayerForBalance>
): TeamAcc[] | null {
  const T = players.length / 5;
  const teams: TeamAcc[] = Array.from({ length: T }, (_, i) => ({
    teamIndex: i,
    sum: 0,
    members: [],
  }));
  const unassigned = new Set(players.map((p) => p.user_id));

  for (const role of roleOrder) {
    for (let _ = 0; _ < T; _++) {
      const sorted = [...teams].sort((a, b) => {
        if (a.sum !== b.sum) return a.sum - b.sum;
        return a.teamIndex - b.teamIndex;
      });
      const team = sorted[0];

      let bestUserId: string | null = null;
      let bestRating = -Infinity;
      for (const uid of unassigned) {
        const p = byId.get(uid)!;
        if (!canPlay(p, role)) continue;
        const r = ratingForRole(p, role);
        if (r > bestRating) {
          bestRating = r;
          bestUserId = uid;
        } else if (r === bestRating && bestUserId !== null && uid < bestUserId) {
          bestUserId = uid;
        }
      }
      if (bestUserId == null) return null;

      team.members.push({ userId: bestUserId, role, ratingUsed: bestRating });
      team.sum += bestRating;
      unassigned.delete(bestUserId);
    }
  }

  if (unassigned.size !== 0) return null;
  return teams;
}

/** Com papéis já fixados pelo fluxo: coloca o maior rating disponível no time mais fraco. */
function greedyAssignWithFixedRoles(
  players: PlayerForBalance[],
  roleOrder: role_type[],
  fixedRole: Map<string, role_type>,
  byId: Map<string, PlayerForBalance>
): TeamAcc[] | null {
  const T = players.length / 5;
  const teams: TeamAcc[] = Array.from({ length: T }, (_, i) => ({
    teamIndex: i,
    sum: 0,
    members: [],
  }));
  const unassigned = new Set(players.map((p) => p.user_id));

  for (const role of roleOrder) {
    for (let _ = 0; _ < T; _++) {
      const sorted = [...teams].sort((a, b) => {
        if (a.sum !== b.sum) return a.sum - b.sum;
        return a.teamIndex - b.teamIndex;
      });
      const team = sorted[0];

      let bestUserId: string | null = null;
      let bestRating = -Infinity;
      for (const uid of unassigned) {
        if (fixedRole.get(uid) !== role) continue;
        const p = byId.get(uid)!;
        const r = ratingForRole(p, role);
        if (r > bestRating) {
          bestRating = r;
          bestUserId = uid;
        } else if (r === bestRating && bestUserId !== null && uid < bestUserId) {
          bestUserId = uid;
        }
      }
      if (bestUserId == null) return null;

      team.members.push({ userId: bestUserId, role, ratingUsed: bestRating });
      team.sum += bestRating;
      unassigned.delete(bestUserId);
    }
  }

  if (unassigned.size !== 0) return null;
  return teams;
}

/**
 * Troca dois jogadores entre times (mesma posição). Melhora o balanceamento.
 */
function localSearchSwap(teams: TeamAcc[], byId: Map<string, PlayerForBalance>): TeamAcc[] {
  const T = teams.length;
  let current = cloneTeams(teams);
  let v = teamVariance(current);
  let improved = true;

  while (improved) {
    improved = false;
    outer: for (let a = 0; a < T; a++) {
      for (let b = a + 1; b < T; b++) {
        for (let i = 0; i < current[a].members.length; i++) {
          for (let j = 0; j < current[b].members.length; j++) {
            const ma = current[a].members[i];
            const mb = current[b].members[j];
            if (ma.role !== mb.role) continue;

            const ra = ratingForRole(byId.get(ma.userId)!, ma.role);
            const rb = ratingForRole(byId.get(mb.userId)!, mb.role);

            const newA = current[a].sum - ma.ratingUsed + rb;
            const newB = current[b].sum - mb.ratingUsed + ra;
            const next = cloneTeams(current);
            next[a].members[i] = { userId: mb.userId, role: ma.role, ratingUsed: rb };
            next[b].members[j] = { userId: ma.userId, role: mb.role, ratingUsed: ra };
            next[a].sum = newA;
            next[b].sum = newB;

            const nv = teamVariance(next);
            if (nv < v - 1e-9) {
              current = next;
              v = nv;
              improved = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return current;
}

function pickCaptain(members: BalancedMember[]): string {
  let best = members[0];
  for (const m of members.slice(1)) {
    if (m.ratingUsed > best.ratingUsed) best = m;
    else if (m.ratingUsed === best.ratingUsed && m.userId < best.userId) best = m;
  }
  return best.userId;
}

function toResult(teams: TeamAcc[]): BalancedTeamResult[] {
  return teams.map((t) => ({
    teamIndex: t.teamIndex,
    members: t.members,
    totalRating: t.sum,
    captainUserId: pickCaptain(t.members),
  }));
}

/**
 * Particiona jogadores em times com uma posição de cada, só em lanes que cada um marcou,
 * minimizando variância das somas (explora 120 ordens de preenchimento + trocas locais).
 */
export function balanceTeams(players: PlayerForBalance[]): BalancedTeamResult[] {
  const n = players.length;
  if (n < 5 || n % 5 !== 0) {
    throw new Error("INVALID_PLAYER_COUNT");
  }
  const T = n / 5;
  const byId = new Map(players.map((p) => [p.user_id, p]));

  if (!isLaneAssignmentFeasible(players, T)) {
    throw new Error("INFEASIBLE_LANES");
  }

  const orders = permutations([...BALANCE_ROLES]);
  let best: TeamAcc[] | null = null;
  let bestVar = Infinity;
  let bestTotal = -Infinity;

  for (const order of orders) {
    const g = greedyAssign(players, order, byId);
    if (!g) continue;
    const refined = localSearchSwap(g, byId);
    const tv = teamVariance(refined);
    const tt = totalRatingSum(refined);
    if (tv < bestVar - 1e-9 || (Math.abs(tv - bestVar) < 1e-9 && tt > bestTotal)) {
      bestVar = tv;
      bestTotal = tt;
      best = refined;
    }
  }

  if (!best) {
    const fixed = extractRoleAssignmentFromMaxFlow(players, T);
    if (!fixed) {
      throw new Error("INFEASIBLE_LANES");
    }
    for (const order of orders) {
      const g = greedyAssignWithFixedRoles(players, order, fixed, byId);
      if (!g) continue;
      const refined = localSearchSwap(g, byId);
      const tv = teamVariance(refined);
      const tt = totalRatingSum(refined);
      if (tv < bestVar - 1e-9 || (Math.abs(tv - bestVar) < 1e-9 && tt > bestTotal)) {
        bestVar = tv;
        bestTotal = tt;
        best = refined;
      }
    }
  }

  if (!best) {
    throw new Error("NO_ASSIGNMENT");
  }

  return toResult(best);
}
