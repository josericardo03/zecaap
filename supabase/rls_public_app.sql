-- =============================================================================
-- RLS — torneios, times, partidas, MVP (defesa em profundidade no Postgres)
-- Executar no SQL Editor do Supabase (Database → SQL Editor).
--
-- NOTA: A app Next.js usa Prisma com o role `postgres` (pooler), que em geral
-- **ignora RLS**. As permissões reais continuam nas server actions (`src/lib/server-permissions.ts`).
-- Estas políticas protegem acesso direto via PostgREST / cliente Supabase com JWT (`authenticated`).
-- =============================================================================

-- Funções auxiliares (SECURITY DEFINER para ler sem recursão de RLS nas subconsultas)
CREATE OR REPLACE FUNCTION public.is_tournament_organizer(p_tournament_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id AND t.created_by = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tournament_player(p_tournament_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_players tp
    WHERE tp.tournament_id = p_tournament_id AND tp.user_id = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_tournament(p_tournament_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tournament_organizer(p_tournament_id, p_uid)
      OR public.is_tournament_player(p_tournament_id, p_uid);
$$;

-- -----------------------------------------------------------------------------
-- tournaments
-- -----------------------------------------------------------------------------
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select_participants" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_insert_creator" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_update_organizer" ON public.tournaments;
DROP POLICY IF EXISTS "tournaments_delete_organizer" ON public.tournaments;

CREATE POLICY "tournaments_select_participants"
ON public.tournaments FOR SELECT TO authenticated
USING (public.user_can_view_tournament(id, auth.uid()));

CREATE POLICY "tournaments_insert_creator"
ON public.tournaments FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "tournaments_update_organizer"
ON public.tournaments FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "tournaments_delete_organizer"
ON public.tournaments FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- tournament_players
-- -----------------------------------------------------------------------------
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tp_select" ON public.tournament_players;
DROP POLICY IF EXISTS "tp_insert_self" ON public.tournament_players;
DROP POLICY IF EXISTS "tp_update_self" ON public.tournament_players;
DROP POLICY IF EXISTS "tp_delete_self_or_org" ON public.tournament_players;

CREATE POLICY "tp_select"
ON public.tournament_players FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_tournament_organizer(tournament_id, auth.uid())
);

CREATE POLICY "tp_insert_self"
ON public.tournament_players FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_tournament_player(tournament_id, auth.uid()) = false
);

-- Inscrição: só o próprio utilizador cria a sua linha (incl. join por código)
-- Regra: primeiro INSERT com user_id = auth.uid()

CREATE POLICY "tp_update_self"
ON public.tournament_players FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "tp_delete_self_or_org"
ON public.tournament_players FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_tournament_organizer(tournament_id, auth.uid())
);

-- -----------------------------------------------------------------------------
-- teams
-- -----------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select" ON public.teams;
DROP POLICY IF EXISTS "teams_update_captain_or_org" ON public.teams;

CREATE POLICY "teams_select"
ON public.teams FOR SELECT TO authenticated
USING (
  public.user_can_view_tournament(tournament_id, auth.uid())
);

CREATE POLICY "teams_update_captain_or_org"
ON public.teams FOR UPDATE TO authenticated
USING (
  captain_user_id = auth.uid()
  OR public.is_tournament_organizer(tournament_id, auth.uid())
)
WITH CHECK (
  captain_user_id = auth.uid()
  OR public.is_tournament_organizer(tournament_id, auth.uid())
);

CREATE POLICY "teams_insert_organizer"
ON public.teams FOR INSERT TO authenticated
WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- team_members
-- -----------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tm_select" ON public.team_members;

CREATE POLICY "tm_select"
ON public.team_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND public.user_can_view_tournament(t.tournament_id, auth.uid())
  )
);

-- Escrita em `team_members` permitida ao organizador (via supabase).
CREATE POLICY "tm_write_organizer"
ON public.team_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND public.is_tournament_organizer(t.tournament_id, auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND public.is_tournament_organizer(t.tournament_id, auth.uid())
  )
);

-- -----------------------------------------------------------------------------
-- matches
-- -----------------------------------------------------------------------------
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select" ON public.matches;
DROP POLICY IF EXISTS "matches_write_organizer" ON public.matches;

CREATE POLICY "matches_select"
ON public.matches FOR SELECT TO authenticated
USING (public.user_can_view_tournament(tournament_id, auth.uid()));

CREATE POLICY "matches_write_organizer"
ON public.matches FOR ALL TO authenticated
USING (public.is_tournament_organizer(tournament_id, auth.uid()))
WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- draft_picks
-- -----------------------------------------------------------------------------
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "draft_picks_select" ON public.draft_picks;
DROP POLICY IF EXISTS "draft_picks_write" ON public.draft_picks;

CREATE POLICY "draft_picks_select"
ON public.draft_picks FOR SELECT TO authenticated
USING (public.user_can_view_tournament(tournament_id, auth.uid()));

CREATE POLICY "draft_picks_write"
ON public.draft_picks FOR ALL TO authenticated
USING (
  public.is_tournament_organizer(tournament_id, auth.uid())
  OR captain_user_id = auth.uid()
)
WITH CHECK (
  public.is_tournament_organizer(tournament_id, auth.uid())
  OR captain_user_id = auth.uid()
);

-- -----------------------------------------------------------------------------
-- match_mvp_votes
-- -----------------------------------------------------------------------------
ALTER TABLE public.match_mvp_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mvp_select" ON public.match_mvp_votes;
DROP POLICY IF EXISTS "mvp_insert" ON public.match_mvp_votes;
DROP POLICY IF EXISTS "mvp_update" ON public.match_mvp_votes;
DROP POLICY IF EXISTS "mvp_delete" ON public.match_mvp_votes;

CREATE POLICY "mvp_select"
ON public.match_mvp_votes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_mvp_votes.match_id
      AND public.user_can_view_tournament(m.tournament_id, auth.uid())
  )
);

CREATE POLICY "mvp_insert"
ON public.match_mvp_votes FOR INSERT TO authenticated
WITH CHECK (
  voter_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_mvp_votes.match_id
      AND public.is_tournament_player(m.tournament_id, auth.uid())
  )
);

CREATE POLICY "mvp_update"
ON public.match_mvp_votes FOR UPDATE TO authenticated
USING (voter_user_id = auth.uid())
WITH CHECK (
  voter_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_mvp_votes.match_id
      AND public.is_tournament_player(m.tournament_id, auth.uid())
  )
);

CREATE POLICY "mvp_delete"
ON public.match_mvp_votes FOR DELETE TO authenticated
USING (voter_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- tournament_results
-- -----------------------------------------------------------------------------
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tr_select" ON public.tournament_results;
DROP POLICY IF EXISTS "tr_write_organizer" ON public.tournament_results;

CREATE POLICY "tr_select"
ON public.tournament_results FOR SELECT TO authenticated
USING (public.user_can_view_tournament(tournament_id, auth.uid()));

CREATE POLICY "tr_write_organizer"
ON public.tournament_results FOR ALL TO authenticated
USING (public.is_tournament_organizer(tournament_id, auth.uid()))
WITH CHECK (public.is_tournament_organizer(tournament_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- tournament_peer_ratings
-- -----------------------------------------------------------------------------
ALTER TABLE public.tournament_peer_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "peer_select" ON public.tournament_peer_ratings;
DROP POLICY IF EXISTS "peer_write_rater" ON public.tournament_peer_ratings;
DROP POLICY IF EXISTS "peer_update_rater" ON public.tournament_peer_ratings;

CREATE POLICY "peer_select"
ON public.tournament_peer_ratings FOR SELECT TO authenticated
USING (public.user_can_view_tournament(tournament_id, auth.uid()));

CREATE POLICY "peer_write_rater"
ON public.tournament_peer_ratings FOR INSERT TO authenticated
WITH CHECK (
  rater_id = auth.uid()
  AND public.is_tournament_player(tournament_id, auth.uid())
);

CREATE POLICY "peer_update_rater"
ON public.tournament_peer_ratings FOR UPDATE TO authenticated
USING (rater_id = auth.uid())
WITH CHECK (rater_id = auth.uid());
