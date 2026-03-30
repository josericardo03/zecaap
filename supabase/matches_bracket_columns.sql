-- Colunas para chaveamento (eliminação simples). Executar no SQL Editor do Supabase se não usares `prisma db push`.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS position_in_round integer;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_match_a_id uuid;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_match_b_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_source_match_a_id_fkey'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_source_match_a_id_fkey
      FOREIGN KEY (source_match_a_id) REFERENCES public.matches (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_source_match_b_id_fkey'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_source_match_b_id_fkey
      FOREIGN KEY (source_match_b_id) REFERENCES public.matches (id) ON DELETE SET NULL;
  END IF;
END $$;
