-- Executar no SQL Editor do Supabase (Database → SQL Editor)
-- Corrige RLS para avatar (Storage) e profiles

-- Bucket público
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Storage: remove políticas antigas com nomes possíveis
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;

-- Leitura pública (URLs getPublicUrl)
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Caminho: {auth.uid()}/ficheiro — usar split_part (compatível; foldername nem sempre existe)
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (auth.uid())::text
);

CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = (auth.uid())::text
);

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_all"
ON public.profiles FOR SELECT
TO public
USING (true);

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
