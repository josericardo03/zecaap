"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitLock = useRef(false);
  const supabase = createClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    setError(null);
    submitLock.current = true;
    setLoading(true);

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${origin}/redefinir-senha` },
    );

    if (err) {
      setError(formatAuthErrorMessage(err));
      setLoading(false);
      submitLock.current = false;
      return;
    }

    setSent(true);
    setLoading(false);
    submitLock.current = false;
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <p className="text-2xl font-semibold italic tracking-tight text-tm-purple">
          TourneyMaster
        </p>
        <h1 className="mt-4 text-2xl font-bold text-white">Recuperar senha</h1>
        <p className="mt-1 text-sm text-tm-muted">
          Enviaremos um link para o teu e-mail
        </p>
      </div>

      {sent ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
          Se existir uma conta com este e-mail, recebeste instruções para
          redefinir a senha. Verifica a caixa de entrada e o spam.
        </p>
      ) : (
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
            {loading ? "A enviar…" : "Enviar link"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-tm-muted">
        <Link href="/login" className="font-medium text-tm-cyan hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
