"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Camera } from "lucide-react";

type Props = {
  userId: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
};

export function ProfileForm({
  userId,
  initialNickname,
  initialAvatarUrl,
}: Props) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setError(upErr.message);
      setLoading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        nickname: nickname.trim() || "Jogador",
        avatar_url: publicUrl,
      },
      { onConflict: "id" }
    );
    if (dbErr) setError(dbErr.message);
    else setAvatarUrl(publicUrl);
    setLoading(false);
    router.refresh();
  }

  async function onSaveNickname(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: dbErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        nickname: nickname.trim(),
        avatar_url: avatarUrl,
      },
      { onConflict: "id" }
    );
    if (dbErr) setError(dbErr.message);
    setLoading(false);
    router.refresh();
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center">
        <label htmlFor="profile-avatar-file" className="relative cursor-pointer">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-tm-purple/50 bg-tm-surface shadow-[0_0_30px_-8px_rgba(138,112,255,0.6)]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Avatar"
                fill
                className="object-cover"
                sizes="112px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-tm-cyan">
                {nickname.slice(0, 2).toUpperCase() || "?"}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </div>
        </label>
        <input
          id="profile-avatar-file"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onUpload}
          disabled={loading}
        />
        <p className="mt-2 text-xs text-tm-muted">Clica na imagem para alterar</p>
      </div>

      <form onSubmit={onSaveNickname} className="space-y-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Nickname
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 placeholder:text-tm-muted focus:ring-2"
            placeholder="Seu nome no jogo"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/20 hover:brightness-110 disabled:opacity-50"
        >
          Salvar nickname
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-xl border border-white/10 py-3 text-sm text-tm-muted transition hover:bg-white/5"
      >
        Sair
      </button>
    </div>
  );
}
