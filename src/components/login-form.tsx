"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setError(null);
    submitLock.current = true;
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(formatAuthErrorMessage(err));
      setLoading(false);
      submitLock.current = false;
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <p className="font-semibold italic tracking-tight text-tm-purple text-2xl">
          TourneyMaster
        </p>
        <h1 className="mt-4 text-2xl font-bold text-white">Entrar</h1>
        <p className="mt-1 text-sm text-tm-muted">Acesse sua conta</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
              Password
            </label>
            <Link
              href="/esqueci-senha"
              className="text-xs font-medium text-tm-cyan hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 focus:ring-2"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-tm-purple py-3 text-sm font-semibold text-white shadow-lg shadow-tm-purple/25 transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-sm text-tm-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-tm-cyan hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
