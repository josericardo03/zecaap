export function isAuthRateLimitError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  const code = (err?.code ?? "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("email rate limit") ||
    msg.includes("over_email_send_rate_limit") ||
    code.includes("rate_limit") ||
    code === "too_many_requests"
  );
}

export function formatAuthErrorMessage(
  err: { message?: string; code?: string } | null | undefined,
): string {
  if (isAuthRateLimitError(err)) {
    return "Limite de envio de e-mails atingido. Aguarde alguns minutos e tente de novo. Em produção, configure SMTP próprio em Supabase → Authentication → SMTP.";
  }
  const raw = err?.message?.trim();
  return raw && raw.length > 0 ? raw : "Algo deu errado. Tente novamente.";
}
