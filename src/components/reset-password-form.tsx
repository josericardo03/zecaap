"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const submitLock = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    function markReady(session: unknown) {
      if (cancelled) return;
      if (session) setSessionReady(true);
      setSessionChecked(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReady(session);
    });

    async function resolveSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        markReady(session);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const { data: { session: s2 } } = await supabase.auth.getSession();
      markReady(s2);
    }

    void resolveSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current) return;
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError(null);
    submitLock.current = true;
    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(formatAuthErrorMessage(err));
      setLoading(false);
      submitLock.current = false;
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (sessionChecked && !sessionReady) {
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-2xl font-semibold italic tracking-tight text-tm-purple">
          TourneyMaster
        </p>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
          Link inválido ou expirado. Pedes um novo em{" "}
          <Link href="/esqueci-senha" className="text-tm-cyan underline">
            Recuperar senha
          </Link>
          .
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-tm-cyan hover:underline"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  if (!sessionChecked) {
    return (
      <div className="w-full max-w-md text-center text-sm text-tm-muted">
        A carregar…
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <p className="text-2xl font-semibold italic tracking-tight text-tm-purple">
          TourneyMaster
        </p>
        <h1 className="mt-4 text-2xl font-bold text-white">Nova senha</h1>
        <p className="mt-1 text-sm text-tm-muted">Define a tua nova palavra-passe</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Nova senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-tm-surface px-4 py-3 text-white outline-none ring-tm-purple/30 focus:ring-2"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-tm-muted">
            Confirmar senha
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
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
          {loading ? "A guardar…" : "Guardar nova senha"}
        </button>
      </form>

      <p className="text-center text-sm text-tm-muted">
        <Link href="/login" className="font-medium text-tm-cyan hover:underline">
          Voltar ao login
        </Link>
      </p>
    </div>
  );
}
