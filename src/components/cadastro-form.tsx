"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatAuthErrorMessage, isAuthRateLimitError } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";
import { UserPlus } from "lucide-react";

export function CadastroForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const submitLock = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    const now = Date.now();
    if (cooldownUntil !== null && now < cooldownUntil) {
      const s = Math.ceil((cooldownUntil - now) / 1000);
      setError(`Aguarde ${s}s antes de tentar enviar de novo.`);
      return;
    }
    setError(null);
    submitLock.current = true;
    setLoading(true);

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signErr) {
      if (isAuthRateLimitError(signErr)) {
        setCooldownUntil(Date.now() + 120_000);
      }
      setError(formatAuthErrorMessage(signErr));
      setLoading(false);
      submitLock.current = false;
      return;
    }

    const user = data.user;
    const session = data.session;

    if (!user) {
      setError("Não foi possível criar a conta.");
      setLoading(false);
      submitLock.current = false;
      return;
    }

    let avatarUrl: string | null = null;
    if (avatarFile && session) {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (upErr) {
        setError(`Conta criada, mas avatar: ${upErr.message}`);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = publicUrl;
      }
    }

    if (session) {
      const { error: profErr } = await supabase.from("profiles").upsert({
        id: user.id,
        nickname: nickname.trim() || "Jogador",
        avatar_url: avatarUrl,
      });
      if (profErr) setError(profErr.message);
      else {
        router.push("/");
        router.refresh();
        setLoading(false);
        submitLock.current = false;
        return;
      }
    } else {
      setError(
        "Conta criada. Se o Supabase pedir confirmação de e-mail, abra o link recebido e depois entre em Entrar."
      );
    }

    setLoading(false);
    submitLock.current = false;
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <p className="text-2xl font-semibold italic tracking-tight text-tm-purple">
          TourneyMaster
        </p>
        <h1 className="mt-4 text-2xl font-bold text-white">Criar conta</h1>
        <p className="mt-1 text-sm text-tm-muted">
          Nickname, foto e credenciais — estilo pro player
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="flex flex-col items-center">
          <label className="relative cursor-pointer">
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-tm-purple/40 bg-tm-surface">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Pré-visualização"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <UserPlus className="h-10 w-10 text-tm-muted" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
          <span className="mt-2 text-xs text-tm-muted">Avatar (opcional)</span>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Nickname
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            minLength={2}
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 focus:ring-2"
            placeholder="Como quer ser chamado"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 focus:ring-2"
            placeholder="nome@email.com"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 focus:ring-2"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-tm-purple py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_-8px_rgba(138,112,255,0.7)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>

      <p className="text-center text-sm text-tm-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-tm-cyan hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
